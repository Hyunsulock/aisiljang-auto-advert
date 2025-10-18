CREATE TABLE `batch_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`offer_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`remove_status` text DEFAULT 'pending',
	`upload_status` text DEFAULT 'pending',
	`modified_price` text,
	`modified_rent` text,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`remove_started_at` integer,
	`remove_completed_at` integer,
	`upload_started_at` integer,
	`upload_completed_at` integer,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number_n` text NOT NULL,
	`number_a` text NOT NULL,
	`type` text NOT NULL,
	`dong` text,
	`address` text NOT NULL,
	`area_public` text,
	`area_private` text,
	`deal_type` text NOT NULL,
	`price` text NOT NULL,
	`rent` text,
	`ad_channel` text,
	`ad_method` text,
	`ad_status` text NOT NULL,
	`date_range` text,
	`ranking` integer,
	`shared_rank` integer,
	`is_shared` integer,
	`shared_count` integer,
	`total` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_number_n_unique` ON `offers` (`number_n`);