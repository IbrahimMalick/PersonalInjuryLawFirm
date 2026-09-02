CREATE TABLE "adverse_parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer,
	"lead_id" text,
	"user_id" integer,
	"type" text NOT NULL,
	"detail" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" text NOT NULL,
	"used_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"practice_line" text DEFAULT 'Injury Law' NOT NULL,
	"address_line" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"default_jurisdiction" text DEFAULT 'NY' NOT NULL,
	"twilio_number" text,
	"email_inbound_token" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"trial_ends_at" text,
	"sol_acknowledged_at" text,
	"sol_acknowledged_by" integer,
	"onboarding_dismissed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_at" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 4 NOT NULL,
	"last_error" text,
	"started_at" text,
	"finished_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"channel" text NOT NULL,
	"external_id" text,
	"from_address" text NOT NULL,
	"display_name" text,
	"raw" text NOT NULL,
	"meta" jsonb,
	"received_at" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"case_file" jsonb,
	"draft_reply" text,
	"draft_language" text DEFAULT 'en' NOT NULL,
	"processed_at" text,
	"processing_error" text,
	"reviewed_by" integer,
	"reviewed_at" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"lead_id" text NOT NULL,
	"channel" text NOT NULL,
	"to_address" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"approved_by" integer NOT NULL,
	"approved_at" text NOT NULL,
	"sent_at" text,
	"provider_id" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'reviewer' NOT NULL,
	"email_verified_at" text,
	"disabled_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "adverse_firm_idx" ON "adverse_parties" USING btree ("firm_id","active");--> statement-breakpoint
CREATE INDEX "audit_firm_idx" ON "audit_events" USING btree ("firm_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_lead_idx" ON "audit_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "firms_slug_idx" ON "firms" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "firms_email_token_idx" ON "firms" USING btree ("email_inbound_token");--> statement-breakpoint
CREATE INDEX "firms_twilio_idx" ON "firms" USING btree ("twilio_number");--> statement-breakpoint
CREATE INDEX "jobs_pending_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "leads_firm_status_idx" ON "leads" USING btree ("firm_id","status");--> statement-breakpoint
CREATE INDEX "leads_firm_received_idx" ON "leads" USING btree ("firm_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_external_idx" ON "leads" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "messages_lead_idx" ON "messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "messages_firm_idx" ON "messages" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_firm_idx" ON "users" USING btree ("firm_id");