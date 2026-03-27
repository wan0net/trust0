ALTER TABLE `app` ADD `api_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `app_api_key_unique` ON `app` (`api_key`);