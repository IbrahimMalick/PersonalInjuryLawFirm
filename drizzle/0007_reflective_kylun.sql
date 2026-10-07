CREATE TABLE "rate_limit_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_hits_scope_idx" ON "rate_limit_hits" USING btree ("scope","created_at");