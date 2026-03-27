ALTER TABLE `app` ADD `license_model` text DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE `app` ADD `license_info` text;--> statement-breakpoint
ALTER TABLE `organization` ADD `org_type` text DEFAULT 'personal' NOT NULL;