CREATE TABLE `adverse_parties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer NOT NULL,
	`name` text NOT NULL,
	`relationship` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `adverse_firm_idx` ON `adverse_parties` (`firm_id`,`active`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer,
	`lead_id` text,
	`user_id` integer,
	`type` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_firm_idx` ON `audit_events` (`firm_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_lead_idx` ON `audit_events` (`lead_id`);--> statement-breakpoint
CREATE TABLE `firms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`practice_line` text DEFAULT 'Injury Law' NOT NULL,
	`address_line` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`default_jurisdiction` text DEFAULT 'NY' NOT NULL,
	`twilio_number` text,
	`email_inbound_token` text NOT NULL,
	`sol_acknowledged_at` text,
	`sol_acknowledged_by` integer,
	`onboarding_dismissed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firms_slug_idx` ON `firms` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `firms_email_token_idx` ON `firms` (`email_inbound_token`);--> statement-breakpoint
CREATE INDEX `firms_twilio_idx` ON `firms` (`twilio_number`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`run_at` text DEFAULT (datetime('now')) NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 4 NOT NULL,
	`last_error` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_pending_idx` ON `jobs` (`status`,`run_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` integer NOT NULL,
	`channel` text NOT NULL,
	`external_id` text,
	`from_address` text NOT NULL,
	`display_name` text,
	`raw` text NOT NULL,
	`meta` text,
	`received_at` text DEFAULT (datetime('now')) NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`case_file` text,
	`draft_reply` text,
	`draft_language` text DEFAULT 'en' NOT NULL,
	`processed_at` text,
	`processing_error` text,
	`reviewed_by` integer,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `leads_firm_status_idx` ON `leads` (`firm_id`,`status`);--> statement-breakpoint
CREATE INDEX `leads_firm_received_idx` ON `leads` (`firm_id`,`received_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `leads_external_idx` ON `leads` (`channel`,`external_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer NOT NULL,
	`lead_id` text NOT NULL,
	`channel` text NOT NULL,
	`to_address` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`approved_by` integer NOT NULL,
	`approved_at` text DEFAULT (datetime('now')) NOT NULL,
	`sent_at` text,
	`provider_id` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `messages_lead_idx` ON `messages` (`lead_id`);--> statement-breakpoint
CREATE INDEX `messages_firm_idx` ON `messages` (`firm_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firm_id` integer NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'reviewer' NOT NULL,
	`disabled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_firm_idx` ON `users` (`firm_id`);