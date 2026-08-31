CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` text NOT NULL,
	`success` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`staff_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `staff` ADD `telegram_id` text;--> statement-breakpoint
ALTER TABLE `staff` ADD `username` text;--> statement-breakpoint
ALTER TABLE `staff` ADD `photo_url` text;--> statement-breakpoint
ALTER TABLE `staff` ADD `last_seen_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `staff_telegram_id_unique` ON `staff` (`telegram_id`);