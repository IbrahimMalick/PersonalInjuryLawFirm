ALTER TABLE "firms" ADD COLUMN "converted_at" text;--> statement-breakpoint
-- Backfill: firms that already have a Stripe subscription predate this
-- column, so their real conversion timestamp isn't known. Approximate with
-- their registration date rather than leaving them out of "total paid"
-- entirely. Every conversion going forward gets an exact timestamp from the
-- webhook.
UPDATE "firms" SET "converted_at" = "created_at" WHERE "stripe_subscription_id" IS NOT NULL AND "converted_at" IS NULL;