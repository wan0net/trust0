import {
	computeLinkHash,
	parseChainLink,
	parseProfile,
	verifyChain,
} from "@trust0/identity";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "./db/schema";
import { type AuthEnv, requireAuth, sessionMiddleware } from "./middleware/session";
import { assertProfileMatchesChainState } from "./policy";

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

	let parsedProfile;
	try {
		parsedProfile = await parseProfile(body.profile.profileJws);
	} catch (err) {
		return c.json(
			{ error: `Invalid profile: ${(err as Error).message}` },
			400,
		);
	}

	if (parsedProfile.fingerprint !== body.profile.fingerprint) {
		return c.json({ error: "Profile fingerprint mismatch" }, 400);
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

	const [existingFingerprint] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, parsedProfile.fingerprint))
		.limit(1);

	if (existingFingerprint) {
		return c.json({ error: "Profile fingerprint already exists on this instance." }, 409);
	}

	let verifiedIdentityId: string | null = null;
	const normalizedChain: Array<{
		id: string;
		fingerprint: string;
		seqno: number;
		type: string;
		linkJws: string;
		prevHash: string | null;
	}> = [];

	if (body.chain.length > 0) {
		let parsedLinks;
		try {
			parsedLinks = await Promise.all(
				body.chain.map(async (link) => {
					const parsed = await parseChainLink(link.linkJws);
					const linkHash = await computeLinkHash(link.linkJws);
					return { parsed, linkHash, linkJws: link.linkJws };
				}),
			);
		} catch (err) {
			return c.json(
				{ error: `Invalid chain link: ${(err as Error).message}` },
				400,
			);
		}

		parsedLinks.sort((a, b) => a.parsed.seqno - b.parsed.seqno);

		let chainState;
		try {
			chainState = await verifyChain(parsedLinks.map((link) => link.linkJws));
		} catch (err) {
			return c.json(
				{ error: `Invalid sigchain: ${(err as Error).message}` },
				400,
			);
		}

		verifiedIdentityId = chainState.identityId;

		if (body.profile.identityId && body.profile.identityId !== verifiedIdentityId) {
			return c.json({ error: "Imported identity ID does not match sigchain" }, 400);
		}

		try {
			assertProfileMatchesChainState(chainState, parsedProfile.fingerprint);
		} catch (err) {
			return c.json({ error: (err as Error).message }, 400);
		}

		normalizedChain.push(
			...parsedLinks.map(({ parsed, linkHash, linkJws }) => ({
				id: linkHash,
				fingerprint: parsed.fingerprint,
				seqno: parsed.seqno,
				type: parsed.type,
				linkJws,
				prevHash: parsed.prev,
			})),
		);
	} else if (body.profile.identityId) {
		return c.json(
			{ error: "Cannot import identity_id without a verifiable sigchain" },
			400,
		);
	}

	if (verifiedIdentityId) {
		const [existingIdentity] = await db
			.select()
			.from(schema.sigchainLink)
			.where(eq(schema.sigchainLink.identityId, verifiedIdentityId))
			.limit(1);

		if (existingIdentity) {
			return c.json({ error: "Identity already exists on this instance." }, 409);
		}
	}

	const now = new Date();

	// Import profile
	await db.insert(schema.cryptoProfile).values({
		fingerprint: parsedProfile.fingerprint,
		profileJws: body.profile.profileJws,
		userId: user.id,
		identityId: verifiedIdentityId,
		createdAt: now,
		updatedAt: now,
	});

	// Import chain links
	for (const link of normalizedChain) {
		await db.insert(schema.sigchainLink).values({
			id: link.id,
			identityId: verifiedIdentityId!,
			fingerprint: link.fingerprint,
			seqno: link.seqno,
			linkType: link.type,
			linkJws: link.linkJws,
			prevHash: link.prevHash,
			createdAt: now,
		});
	}

	return c.json({
		imported: true,
		fingerprint: parsedProfile.fingerprint,
		identityId: verifiedIdentityId,
		ignoredAttestations: body.attestations?.length ?? 0,
	}, 201);
});

export { exportApi as exportRoutes };
