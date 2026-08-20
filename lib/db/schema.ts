import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// One instance = one firm. The firm row is a singleton (id = 1).

export const firm = sqliteTable("firm", {
  id: integer("id").primaryKey(), // always 1
  name: text("name").notNull(), // "Reyes & Cole"
  practiceLine: text("practice_line").notNull().default("Injury Law"),
  addressLine: text("address_line").notNull().default(""),
  phone: text("phone").notNull().default(""),
  timezone: text("timezone").notNull().default("America/New_York"),
  defaultJurisdiction: text("default_jurisdiction").notNull().default("NY"),
  // The SOL table ships as code; an attorney must review and acknowledge it
  // before the system will display computed deadlines.
  solAcknowledgedAt: text("sol_acknowledged_at"),
  solAcknowledgedBy: integer("sol_acknowledged_by"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "reviewer"] }).notNull().default("reviewer"),
    disabledAt: text("disabled_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const adverseParties = sqliteTable("adverse_parties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(), // "Current client — X v. Y (active)"
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// A lead is one inbound inquiry, in whatever form it arrived.
export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(), // uuid
    channel: text("channel", {
      enum: ["sms", "voicemail", "webform", "whatsapp", "email"],
    }).notNull(),
    // Provider-side id (Twilio MessageSid / CallSid, email Message-ID) for idempotency.
    externalId: text("external_id"),
    fromAddress: text("from_address").notNull(), // phone / email / "webform"
    displayName: text("display_name"),
    raw: text("raw").notNull(), // transcript / body / form dump as received
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    receivedAt: text("received_at").notNull().default(sql`(datetime('now'))`),
    status: text("status", {
      enum: ["received", "processing", "triaged", "needs_attention", "archived"],
    })
      .notNull()
      .default("received"),
    // The structured CaseFile (lib/schema.ts) once triage completes.
    caseFile: text("case_file", { mode: "json" }).$type<Record<string, unknown>>(),
    draftReply: text("draft_reply"),
    draftLanguage: text("draft_language").notNull().default("en"),
    processedAt: text("processed_at"),
    processingError: text("processing_error"),
    reviewedBy: integer("reviewed_by"),
    reviewedAt: text("reviewed_at"),
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_received_idx").on(t.receivedAt),
    uniqueIndex("leads_external_idx").on(t.channel, t.externalId),
  ]
);

// Outbound replies. Draft lives on the lead; approval creates a message row.
export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: text("lead_id").notNull(),
    channel: text("channel").notNull(),
    toAddress: text("to_address").notNull(),
    body: text("body").notNull(), // final text incl. disclaimer, as approved
    status: text("status", {
      enum: ["queued", "sent", "simulated", "failed"],
    })
      .notNull()
      .default("queued"),
    approvedBy: integer("approved_by").notNull(),
    approvedAt: text("approved_at").notNull().default(sql`(datetime('now'))`),
    sentAt: text("sent_at"),
    providerId: text("provider_id"),
    error: text("error"),
  },
  (t) => [index("messages_lead_idx").on(t.leadId)]
);

// DB-backed job queue: survives restarts, retries with backoff.
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: ["process_lead", "send_message", "transcribe_voicemail"] }).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "running", "done", "failed", "dead"] })
      .notNull()
      .default("pending"),
    runAt: text("run_at").notNull().default(sql`(datetime('now'))`),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(4),
    lastError: text("last_error"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index("jobs_pending_idx").on(t.status, t.runAt)]
);

// Append-only. Every consequential action — machine or human — lands here.
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: text("lead_id"),
    userId: integer("user_id"), // null = the system
    type: text("type").notNull(), // lead.received, lead.triaged, extraction.failed,
    // conflict.flagged, reply.edited, reply.approved, message.sent, settings.changed, ...
    detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index("audit_lead_idx").on(t.leadId), index("audit_created_idx").on(t.createdAt)]
);

export type UserRow = typeof users.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type AdversePartyRow = typeof adverseParties.$inferSelect;
export type AuditRow = typeof auditEvents.$inferSelect;
export type FirmRow = typeof firm.$inferSelect;
