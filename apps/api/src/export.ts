import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "./db/schema";
import { type AuthEnv, requireAuth, sessionMiddleware } from "./middleware/session";

const exportApi = new Hono<AuthEnv>();

// ── Export: Download your complete identity ────────────────────────────────

exportApi.use("/api/identity/export", sessionMiddleware);

exportApi.get("/api/identity/export", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");

	// Find user's profile
	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.userId, user.id))
		.limit(1);

	if (!profile) {
		return c.json({ error: "No profile found" }, 404);
	}

	// Fetch chain links
	const links = profile.identityId
		? await db
				.select()
				.from(schema.sigchainLink)
				.where(eq(schema.sigchainLink.identityId, profile.identityId))
				.orderBy(asc(schema.sigchainLink.seqno))
		: [];

	// Fetch username
	const [username] = await db
		.select()
		.from(schema.username)
		.where(eq(schema.username.fingerprint, profile.fingerprint))
		.limit(1);

	// Fetch attestations
	const attestations = await db
		.select()
		.from(schema.attestation)
		.where(eq(schema.attestation.fingerprint, profile.fingerprint));

	return c.json({
		version: 1,
		exportedAt: new Date().toISOString(),
		profile: {
			fingerprint: profile.fingerprint,
			profileJws: profile.profileJws,
			identityId: profile.identityId,
		},
		username: username?.username ?? null,
		chain: links.map((l) => ({
			seqno: l.seqno,
			type: l.linkType,
			linkJws: l.linkJws,
		})),
		attestations: attestations.map((a) => ({
			type: a.type,
			platform: a.platform,
			platformUsername: a.platformUsername,
			value: a.value,
			attestedBy: a.attestedBy,
			attestedAt: a.attestedAt,
		})),
	});
});

// ── Import: Register an exported identity on this instance ─────────────────

exportApi.use("/api/identity/import", sessionMiddleware);

exportApi.post("/api/identity/import", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");

	const body = await c.req.json<{
		version: number;
		profile: { fingerprint: string; profileJws: string; identityId?: string };
		chain: Array<{ seqno: number; type: string; linkJws: string }>;
		attestations?: Array<{
			type: string;
			platform?: string;
			platformUsername?: string;
			value: string;
			attestedBy: string;
			attestedAt: string;
		}>;
	}>();

	if (body.version !== 1) {
		return c.json({ error: "Unsupported export version" }, 400);
	}

	// Check user doesn't already have a profile
	const [existing] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.userId, user.id))
		.limit(1);

	if (existing) {
		return c.json({ error: "User already has a profile. Delete it first to import." }, 409);
	}

	const now = new Date();

	// Import profile
	await db.insert(schema.cryptoProfile).values({
		fingerprint: body.profile.fingerprint,
		profileJws: body.profile.profileJws,
		userId: user.id,
		identityId: body.profile.identityId ?? null,
		createdAt: now,
		updatedAt: now,
	});

	// Import chain links
	if (body.chain.length > 0 && body.profile.identityId) {
		for (const link of body.chain) {
			const { computeLinkHash } = await import("@trust0/identity");
			const linkHash = await computeLinkHash(link.linkJws);

			await db
				.insert(schema.sigchainLink)
				.values({
					id: linkHash,
					identityId: body.profile.identityId,
					fingerprint: body.profile.fingerprint,
					seqno: link.seqno,
					linkType: link.type,
					linkJws: link.linkJws,
					prevHash: null, // Could reconstruct, but the JWS contains it
					createdAt: now,
				})
				.onConflictDoNothing();
		}
	}

	// Import attestations
	if (body.attestations) {
		for (const att of body.attestations) {
			const id = `${att.type}_${body.profile.fingerprint}`;
			await db
				.insert(schema.attestation)
				.values({
					id,
					fingerprint: body.profile.fingerprint,
					type: att.type,
					platform: att.platform ?? null,
					platformUsername: att.platformUsername ?? null,
					value: att.value,
					attestedBy: att.attestedBy,
					attestedAt: new Date(att.attestedAt),
				})
				.onConflictDoNothing();
		}
	}

	return c.json({ imported: true, fingerprint: body.profile.fingerprint }, 201);
});

export { exportApi as exportRoutes };
