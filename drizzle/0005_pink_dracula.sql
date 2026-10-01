CREATE TABLE "lead_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"firm_id" integer NOT NULL,
	"lead_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lead_notes_lead_idx" ON "lead_notes" USING btree ("lead_id","created_at");