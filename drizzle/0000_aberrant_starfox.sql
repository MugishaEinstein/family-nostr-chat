CREATE TABLE `family_audit_log` (
	`id` varchar(36) NOT NULL,
	`familyId` varchar(36) NOT NULL,
	`actorPubkey` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`targetPubkey` varchar(64),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_invites` (
	`id` varchar(36) NOT NULL,
	`familyId` varchar(36) NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`createdByPubkey` varchar(64) NOT NULL,
	`maxUses` int NOT NULL DEFAULT 10,
	`uses` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`revoked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_invites_code_hash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyId` varchar(36) NOT NULL,
	`pubkey` varchar(64) NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`removedAt` timestamp,
	CONSTRAINT `family_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_members_family_pubkey_unique` UNIQUE(`familyId`,`pubkey`)
);
--> statement-breakpoint
CREATE TABLE `family_spaces` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(72) NOT NULL,
	`name` varchar(120) NOT NULL,
	`relayUrl` varchar(320) NOT NULL,
	`ownerPubkey` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_spaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_spaces_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `nostr_api_nonces` (
	`eventId` varchar(64) NOT NULL,
	`pubkey` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nostr_api_nonces_eventId` PRIMARY KEY(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `family_audit_log_family_idx` ON `family_audit_log` (`familyId`);--> statement-breakpoint
CREATE INDEX `family_invites_family_idx` ON `family_invites` (`familyId`);--> statement-breakpoint
CREATE INDEX `family_members_pubkey_idx` ON `family_members` (`pubkey`);--> statement-breakpoint
CREATE INDEX `family_members_family_idx` ON `family_members` (`familyId`);--> statement-breakpoint
CREATE INDEX `family_spaces_owner_idx` ON `family_spaces` (`ownerPubkey`);--> statement-breakpoint
CREATE INDEX `nostr_api_nonces_expiry_idx` ON `nostr_api_nonces` (`expiresAt`);