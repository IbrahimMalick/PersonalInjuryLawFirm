DROP INDEX "leads_external_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "leads_external_idx" ON "leads" USING btree ("firm_id","channel","external_id");