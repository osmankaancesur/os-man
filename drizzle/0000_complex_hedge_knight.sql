CREATE TABLE `guestbook` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`visitor` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `guestbook_recent` ON `guestbook` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `guestbook_visitor` ON `guestbook` (`visitor`,`created_at`);--> statement-breakpoint
CREATE TABLE `limits` (
	`visitor` text PRIMARY KEY NOT NULL,
	`started` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`post` text NOT NULL,
	`visitor` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post`, `visitor`)
);
