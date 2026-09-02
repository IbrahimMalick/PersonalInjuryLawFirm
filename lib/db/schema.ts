import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Multi-tenant Postgres schema. Every tenant-owned row carries firmId, and
// every query in the app is scoped by it. Timestamps are ISO-8601 strings set
// by the application ($defaultFn) so ordering and comparisons are uniform
// across drivers (Neon/any Postgres in production, embedded PGlite in dev).

const nowIso = () => new Date().toISOString();

export const firms = pgTable(
  "firms",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    practiceLine: text("practice_line").notNull().default("Injury Law"),
    addressLine: text("address_line").notNull().default(""),
    phone: text("phone").notNull().default(""),
    timezone: text("timezone").notNull().default("America/New_York"),
    defaultJurisdiction: text("default_jurisdiction").notNull().default("NY"),
    // Channel identities, provisioned by the operator during onboarding.
    twilioNumber: text("twilio_number"),
    emailInboundToken: text("email_inbound_token").notNull(),
    // Billing (Stripe). Signup starts a trial; the webhook keeps status fresh.
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status"), // trialing|active|past_due|canceled
    trialEndsAt: text("trial_ends_at"),
    // The SOL table ships as code; an attorney at THIS firm must acknowledge it.
    solAcknowledgedAt: text("sol_acknowledged_at"),
    solAcknowledgedBy: integer("sol_acknowledged_by"),
    onboardingDismissedAt: text("onboarding_dismissed_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("firms_slug_idx").on(t.slug),
    uniqueIndex("firms_email_token_idx").on(t.emailInboundToken),
    index("firms_twilio_idx").on(t.twilioNumber),
  ]
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    firmId: integer("firm_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "reviewer"] }).notNull().default("reviewer"),
    emailVerifiedAt: text("email_verified_at"),
    disabledAt: text("disabled_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_firm_idx").on(t.firmId)]
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

// One-time tokens for email verification and password reset.
export const authTokens = pgTable(
  "auth_tokens",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id").notNull(),
    purpose: text("purpose", { enum: ["verify_email", "reset_password"] }).notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.purpose)]
);

export const adverseParties = pgTable(
  "adverse_parties",
  {
    id: serial("id").primaryKey(),
    firmId: integer("firm_id").notNull(),
    name: text("name").notNull(),
    relationship: text("relationship").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: integer("created_by"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("adverse_firm_idx").on(t.firmId, t.active)]
);

export const leads = pgTable(
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
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    receivedAt: text("received_at").notNull().$defaultFn(nowIso),
    status: text("status", {
      enum: ["received", "processing", "triaged", "needs_attention", "archived"],
    })
      .notNull()
      .default("received"),
    caseFile: jsonb("case_file").$type<Record<string, unknown>>(),
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

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
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
    approvedAt: text("approved_at").notNull().$defaultFn(nowIso),
    sentAt: text("sent_at"),
    providerId: text("provider_id"),
    error: text("error"),
  },
  (t) => [index("messages_lead_idx").on(t.leadId), index("messages_firm_idx").on(t.firmId)]
);

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    type: text("type", {
      enum: ["process_lead", "send_message", "transcribe_voicemail"],
    }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "running", "done", "failed", "dead"] })
      .notNull()
      .default("pending"),
    runAt: text("run_at").notNull().$defaultFn(nowIso),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(4),
    lastError: text("last_error"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("jobs_pending_idx").on(t.status, t.runAt)]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    firmId: integer("firm_id"),
    leadId: text("lead_id"),
    userId: integer("user_id"),
    type: text("type").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
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
export type AuthTokenRow = typeof authTokens.$inferSelect;
