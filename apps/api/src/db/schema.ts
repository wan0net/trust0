import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── Auth (Better Auth core — minimal) ──────────────────────────────────────

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ── Cryptographic Identity ─────────────────────────────────────────────────

export const cryptoProfile = sqliteTable("crypto_profile", {
	fingerprint: text("fingerprint").primaryKey(),
	profileJws: text("profile_jws").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	identityId: text("identity_id"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const username = sqliteTable("username", {
	username: text("username").primaryKey(),
	fingerprint: text("fingerprint")
		.notNull()
		.references(() => cryptoProfile.fingerprint),
	claimedAt: integer("claimed_at", { mode: "timestamp" }).notNull(),
});

// ── Sigchain ───────────────────────────────────────────────────────────────

export const sigchainLink = sqliteTable("sigchain_link", {
	id: text("id").primaryKey(),
	identityId: text("identity_id").notNull(),
	fingerprint: text("fingerprint").notNull(),
	seqno: integer("seqno").notNull(),
	linkType: text("link_type").notNull(),
	linkJws: text("link_jws").notNull(),
	prevHash: text("prev_hash"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ── Attestations ───────────────────────────────────────────────────────────

export const attestation = sqliteTable("attestation", {
	id: text("id").primaryKey(),
	fingerprint: text("fingerprint")
		.notNull()
		.references(() => cryptoProfile.fingerprint),
	type: text("type").notNull(),
	platform: text("platform"),
	platformUserId: text("platform_user_id"),
	platformUsername: text("platform_username"),
	value: text("value").notNull(),
	attestedBy: text("attested_by").notNull(),
	attestedAt: integer("attested_at", { mode: "timestamp" }).notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }),
});
