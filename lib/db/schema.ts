import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Multi-tenant: one deployment serves many firms. Every tenant-owned row
// carries firmId, and every query in the app is scoped by it — the scoping
// lives in the data-access paths, not in developer discipline alone.

export const firms = sqliteTable(
  "firms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(), // URL identity: /intake/<slug>
    name: text("name").notNull(),
    practiceLine: text("practice_line").notNull().default("Injury Law"),
    addressLine: text("address_line").notNull().default(""),
    phone: text("phone").notNull().default(""),
    timezone: text("timezone").notNull().default("America/New_York"),
    defaultJurisdiction: text("default_jurisdiction").notNull().default("NY"),
    // Channel identities, provisioned by the operator during onboarding.
    twilioNumber: text("twilio_number"), // inbound routes by the number dialed
    emailInboundToken: text("email_inbound_token").notNull(), // per-firm parse-webhook token
    // The SOL table ships as code; an attorney at THIS firm must review and
    // acknowledge it before deadlines are shown to their reviewers.
    solAcknowledgedAt: text("sol_acknowledged_at"),
    solAcknowledgedBy: integer("sol_acknowledged_by"),
    onboardingDismissedAt: text("onboarding_dismissed_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("firms_slug_idx").on(t.slug),
    uniqueIndex("firms_email_token_idx").on(t.emailInboundToken),
    index("firms_twilio_idx").on(t.twilioNumber),
  ]
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firmId: integer("firm_id").notNull(),
    email: text("email").notNull(), // globally unique — email is the login key
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "reviewer"] }).notNull().default("reviewer"),
    disabledAt: text("disabled_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_firm_idx").on(t.firmId)]
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

export const adverseParties = sqliteTable(
  "adverse_parties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firmId: integer("firm_id").notNull(),
    name: text("name").notNull(),
    relationship: text("relationship").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: integer("created_by"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [index("adverse_firm_idx").on(t.firmId, t.active)]
);

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(), // uuid
    firmId: integer("firm_id").notNull(),
    channel: text("channel", {
      enum: ["sms", "voicemail", "webform", "whatsapp", "email"],
    }).notNull(),
    externalId: text("external_id"),
    fromAddress: text("from_address").notNull(),
    displayName: text("display_name"),
    raw: text("raw").notNull(),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    receivedAt: text("received_at").notNull().default(sql`(datetime('now'))`),
    status: text("status", {
      enum: ["received", "processing", "triaged", "needs_attention", "archived"],
    })
      .notNull()
      .default("received"),
    caseFile: text("case_file", { mode: "json" }).$type<Record<string, unknown>>(),
    draftReply: text("draft_reply"),
    draftLanguage: text("draft_language").notNull().default("en"),
    processedAt: text("processed_at"),
    processingError: text("processing_error"),
    reviewedBy: integer("reviewed_by"),
    reviewedAt: text("reviewed_at"),
  },
  (t) => [
    index("leads_firm_status_idx").on(t.firmId, t.status),
    index("leads_firm_received_idx").on(t.firmId, t.receivedAt),
    uniqueIndex("leads_external_idx").on(t.channel, t.externalId),
  ]
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firmId: integer("firm_id").notNull(),
    leadId: text("lead_id").notNull(),
    channel: text("channel").notNull(),
    toAddress: text("to_address").notNull(),
    body: text("body").notNull(),
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
  (t) => [index("messages_lead_idx").on(t.leadId), index("messages_firm_idx").on(t.firmId)]
);

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

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firmId: integer("firm_id"), // null only for platform-level events (signup throttling etc.)
    leadId: text("lead_id"),
    userId: integer("user_id"),
    type: text("type").notNull(),
    detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    index("audit_firm_idx").on(t.firmId, t.createdAt),
    index("audit_lead_idx").on(t.leadId),
  ]
);

export type UserRow = typeof users.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type AdversePartyRow = typeof adverseParties.$inferSelect;
export type AuditRow = typeof auditEvents.$inferSelect;
export type FirmRow = typeof firms.$inferSelect;
