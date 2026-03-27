-- trust0 initial schema
-- Auth tables (Better Auth core)

CREATE TABLE IF NOT EXISTS `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer NOT NULL DEFAULT 0,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL REFERENCES `user`(`id`)
);

CREATE TABLE IF NOT EXISTS `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`),
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);

-- Cryptographic identity

CREATE TABLE IF NOT EXISTS `crypto_profile` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`profile_jws` text NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`),
	`identity_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `username` (
	`username` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL REFERENCES `crypto_profile`(`fingerprint`),
	`claimed_at` integer NOT NULL
);

-- Sigchain

CREATE TABLE IF NOT EXISTS `sigchain_link` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`seqno` integer NOT NULL,
	`link_type` text NOT NULL,
	`link_jws` text NOT NULL,
	`prev_hash` text,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_sigchain_identity_seqno` ON `sigchain_link`(`identity_id`, `seqno`);
CREATE INDEX IF NOT EXISTS `idx_sigchain_identity_id` ON `sigchain_link`(`identity_id`);
CREATE INDEX IF NOT EXISTS `idx_crypto_profile_user_id` ON `crypto_profile`(`user_id`);
CREATE INDEX IF NOT EXISTS `idx_crypto_profile_identity_id` ON `crypto_profile`(`identity_id`);
CREATE INDEX IF NOT EXISTS `idx_username_fingerprint` ON `username`(`fingerprint`);

-- Attestations

CREATE TABLE IF NOT EXISTS `attestation` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL REFERENCES `crypto_profile`(`fingerprint`),
	`type` text NOT NULL,
	`platform` text,
	`platform_user_id` text,
	`platform_username` text,
	`value` text NOT NULL,
	`attested_by` text NOT NULL,
	`attested_at` integer NOT NULL,
	`expires_at` integer
);

CREATE INDEX IF NOT EXISTS `idx_attestation_fingerprint` ON `attestation`(`fingerprint`);
CREATE INDEX IF NOT EXISTS `idx_attestation_type_value` ON `attestation`(`type`, `value`);
