import {
	computeIdentityId,
	computeLinkHash,
	type ParsedChainLink,
	parseChainLink,
} from "@trust0/identity";
import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as schema from "./db/schema";
import { type AuthEnv, sessionMiddleware } from "./middleware/session";

const sigchain = new Hono<AuthEnv>();

// ── Auth middleware for mutation routes ──────────────────────────────────────

sigchain.use("/api/identity/chain/init", sessionMiddleware);
sigchain.use("/api/identity/chain/append", sessionMiddleware);

// ── GET /api/identity/chain/:id — fetch chain by identity_id or fingerprint ─

sigchain.get("/api/identity/chain/:id", async (c) => {
	const id = c.req.param("id");
	const db = c.get("db");

	let identityId: string;
	let fingerprint: string | null = null;

	if (id.length === 52) {
		// identity_id (BASE32, 52 chars)
		identityId = id;
	} else if (id.length === 26) {
		// fingerprint (BASE32, 26 chars)
		const [profile] = await db
			.select()
			.from(schema.cryptoProfile)
			.where(eq(schema.cryptoProfile.fingerprint, id))
			.limit(1);

		if (!profile || !profile.identityId) {
			return c.json({ error: "Chain not found" }, 404);
		}

		identityId = profile.identityId;
		fingerprint = profile.fingerprint;
	} else {
		return c.json(
			{
				error: "Invalid id: must be 52-char identity_id or 26-char fingerprint",
			},
			400,
		);
	}

	const links = await db
		.select()
		.from(schema.sigchainLink)
		.where(eq(schema.sigchainLink.identityId, identityId))
		.orderBy(asc(schema.sigchainLink.seqno));

	if (links.length === 0) {
		return c.json({ error: "Chain not found" }, 404);
	}

	// If we didn't already resolve the fingerprint, grab it from the first link
	if (!fingerprint) {
		fingerprint = links[0].fingerprint;
	}

	return c.json({
		identityId,
		fingerprint,
		links: links.map((l) => ({
			seqno: l.seqno,
			type: l.linkType,
			linkJws: l.linkJws,
			prevHash: l.prevHash,
			createdAt: l.createdAt,
		})),
	});
});

// ── POST /api/identity/chain/init — initialize a new sigchain ───────────────

sigchain.post("/api/identity/chain/init", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");

	const body = await c.req.json<{ genesisLinkJws: string }>();

	if (!body.genesisLinkJws) {
		return c.json({ error: "genesisLinkJws required" }, 400);
	}

	let parsed: ParsedChainLink;
	try {
		parsed = await parseChainLink(body.genesisLinkJws);
	} catch (err) {
		return c.json(
			{ error: `Invalid genesis link: ${(err as Error).message}` },
			400,
		);
	}

	// Validate genesis link structure
	if (parsed.seqno !== 0) {
		return c.json({ error: "Genesis link must have seqno 0" }, 400);
	}
	if (parsed.type !== "key_init") {
		return c.json({ error: "Genesis link must have type key_init" }, 400);
	}
	if (parsed.prev !== null) {
		return c.json({ error: "Genesis link must have null prev" }, 400);
	}

	// Validate fingerprint ownership
	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, parsed.fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Crypto profile not found for this key" }, 404);
	}

	if (profile.userId !== user.id) {
		return c.json({ error: "Forbidden" }, 403);
	}

	// Check if already initialized
	if (profile.identityId) {
		return c.json({ error: "Chain already initialized for this profile" }, 409);
	}

	let identityId: string;
	let linkHash: string;
	try {
		identityId = await computeIdentityId(body.genesisLinkJws);
		linkHash = await computeLinkHash(body.genesisLinkJws);
	} catch (err) {
		return c.json(
			{ error: `Failed to compute identity: ${(err as Error).message}` },
			400,
		);
	}

	const now = new Date();

	await db.insert(schema.sigchainLink).values({
		id: linkHash,
		identityId,
		fingerprint: parsed.fingerprint,
		seqno: 0,
		linkType: "key_init",
		linkJws: body.genesisLinkJws,
		prevHash: null,
		createdAt: now,
	});

	await db
		.update(schema.cryptoProfile)
		.set({ identityId })
		.where(eq(schema.cryptoProfile.fingerprint, parsed.fingerprint));

	return c.json({ identityId }, 201);
});

// ── POST /api/identity/chain/append — append a link to an existing chain ────

sigchain.post("/api/identity/chain/append", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");

	const body = await c.req.json<{ linkJws: string }>();

	if (!body.linkJws) {
		return c.json({ error: "linkJws required" }, 400);
	}

	let parsed: ParsedChainLink;
	try {
		parsed = await parseChainLink(body.linkJws);
	} catch (err) {
		return c.json(
			{ error: `Invalid chain link: ${(err as Error).message}` },
			400,
		);
	}

	// Validate fingerprint ownership
	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, parsed.fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Crypto profile not found for this key" }, 404);
	}

	if (profile.userId !== user.id) {
		return c.json({ error: "Forbidden" }, 403);
	}

	if (!profile.identityId) {
		return c.json(
			{ error: "Chain not initialized. Call /api/identity/chain/init first." },
			400,
		);
	}

	const identityId = profile.identityId;

	// Get the last link in the chain
	const [lastLink] = await db
		.select()
		.from(schema.sigchainLink)
		.where(eq(schema.sigchainLink.identityId, identityId))
		.orderBy(desc(schema.sigchainLink.seqno))
		.limit(1);

	if (!lastLink) {
		return c.json(
			{ error: "Chain has no links. This should not happen." },
			400,
		);
	}

	// Validate seqno continuity
	if (parsed.seqno !== lastLink.seqno + 1) {
		return c.json(
			{ error: `Expected seqno ${lastLink.seqno + 1}, got ${parsed.seqno}` },
			400,
		);
	}

	// Validate prev hash
	let expectedPrevHash: string;
	try {
		expectedPrevHash = await computeLinkHash(lastLink.linkJws);
	} catch (err) {
		return c.json(
			{ error: `Failed to compute prev hash: ${(err as Error).message}` },
			400,
		);
	}

	if (parsed.prev !== expectedPrevHash) {
		return c.json(
			{ error: "prev hash does not match the last link in the chain" },
			400,
		);
	}

	let linkHash: string;
	try {
		linkHash = await computeLinkHash(body.linkJws);
	} catch (err) {
		return c.json(
			{ error: `Failed to compute link hash: ${(err as Error).message}` },
			400,
		);
	}

	const now = new Date();

	try {
		await db.insert(schema.sigchainLink).values({
			id: linkHash,
			identityId,
			fingerprint: parsed.fingerprint,
			seqno: parsed.seqno,
			linkType: parsed.type,
			linkJws: body.linkJws,
			prevHash: parsed.prev,
			createdAt: now,
		});
	} catch (err) {
		// Unique constraint on (identity_id, seqno) — concurrent append race
		const message = (err as Error).message || "";
		if (message.includes("UNIQUE") || message.includes("unique")) {
			return c.json({ error: "Conflict: another link was appended concurrently. Refetch chain and retry." }, 409);
		}
		throw err;
	}

	return c.json({ seqno: parsed.seqno, identityId });
});

// ── GET /api/identity/id/:identityId — resolve identity to profile ──────────

sigchain.get("/api/identity/id/:identityId", async (c) => {
	const identityId = c.req.param("identityId");
	const db = c.get("db");

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.identityId, identityId))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Identity not found" }, 404);
	}

	const [un] = await db
		.select()
		.from(schema.username)
		.where(eq(schema.username.fingerprint, profile.fingerprint))
		.limit(1);

	return c.json({
		identityId,
		fingerprint: profile.fingerprint,
		profileJws: profile.profileJws,
		username: un?.username ?? null,
		createdAt: profile.createdAt,
	});
});

export { sigchain as sigchainRoutes };
