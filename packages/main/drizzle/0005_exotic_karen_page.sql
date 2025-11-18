CREATE TABLE `competing_ads_analysis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`my_ranking` integer,
	`total_count` integer,
	`has_floor_exposure_advantage` integer,
	`competing_ads_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE cascade
);
