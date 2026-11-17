ALTER TABLE `posts` ADD `youtube_video_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `video_mode` text DEFAULT 'button' NOT NULL;