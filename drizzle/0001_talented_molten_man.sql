ALTER TABLE `dishes` ADD `category` text DEFAULT 'crudo' NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `weight` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `components` text DEFAULT '{}' NOT NULL;