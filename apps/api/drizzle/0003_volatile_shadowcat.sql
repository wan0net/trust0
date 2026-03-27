CREATE TABLE `app` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`free` integer DEFAULT false NOT NULL,
	`description` text,
	`url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_slug_unique` ON `app` (`slug`);