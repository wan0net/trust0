import { computeFingerprint, parseProfile, parseRequest } from "@link42/identity";
import { compactVerify, decodeProtectedHeader, importJWK, type JWK } from "jose";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as schema from "./db/schema";
import {
	type AuthEnv,
	requireAuth,
	sessionMiddleware,
} from "./middleware/session";

const aspe = new Hono<AuthEnv>();

// CORS for .well-known ASPE routes (not covered by /api/* CORS in index.ts)
aspe.use("/.well-known/*", async (c, next) => {
	const origins = c.env.ALLOWED_ORIGINS
		? c.env.ALLOWED_ORIGINS.split(",").map((o: string) => o.trim())
		: [];

	return cors({
		origin: origins,
		allowHeaders: ["Content-Type"],
		allowMethods: ["POST", "GET", "OPTIONS"],
		credentials: true,
		maxAge: 600,
	})(c, next);
});

aspe.get("/.well-known/aspe/version", (c) => {
	return c.json({ version: 0 });
});

aspe.get("/.well-known/aspe/id/:fingerprint", async (c) => {
	const fingerprint = c.req.param("fingerprint");
	const db = c.get("db");

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Profile not found" }, 404);
	}

	return c.text(profile.profileJws, 200, {
		"Content-Type": "application/asp",
	});
});

aspe.use("/.well-known/aspe/post/*", sessionMiddleware);
aspe.use("/api/identity/*", sessionMiddleware);

aspe.post("/.well-known/aspe/post/", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");
	const body = await c.req.text();

	if (!body) {
		return c.json({ error: "Request body required" }, 400);
	}

	let request;
	try {
		request = await parseRequest(body);
	} catch (err) {
		return c.json({ error: `Invalid request: ${(err as Error).message}` }, 400);
	}

	const { action, fingerprint, profileJws } = request;
	const now = new Date();

	if (action === "create") {
		if (!profileJws) {
			return c.json({ error: "profile_jws required for create" }, 400);
		}

		try {
			const profile = await parseProfile(profileJws);
			if (profile.fingerprint !== fingerprint) {
				return c.json({ error: "Profile fingerprint mismatch" }, 400);
			}
		} catch (err) {
			return c.json(
				{ error: `Invalid profile: ${(err as Error).message}` },
				400,
			);
		}

		// Enforce one profile per user
		const [userProfile] = await db
			.select()
			.from(schema.cryptoProfile)
			.where(eq(schema.cryptoProfile.userId, user.id))
			.limit(1);

		if (userProfile) {
			return c.json({ error: "User already has a profile. Use update action." }, 409);
		}

		const [existing] = await db
			.select()
			.from(schema.cryptoProfile)
			.where(eq(schema.cryptoProfile.fingerprint, fingerprint))
			.limit(1);

		if (existing) {
			return c.json(
				{ error: "Profile already exists. Use update action." },
				409,
			);
		}

		await db.insert(schema.cryptoProfile).values({
			fingerprint,
			profileJws,
			userId: user.id,
			createdAt: now,
			updatedAt: now,
		});

		return c.json({ fingerprint, uri: `aspe:${fingerprint}` }, 201);
	}

	if (action === "update") {
		if (!profileJws) {
			return c.json({ error: "profile_jws required for update" }, 400);
		}

		try {
			const profile = await parseProfile(profileJws);
			if (profile.fingerprint !== fingerprint) {
				return c.json({ error: "Profile fingerprint mismatch" }, 400);
			}
		} catch (err) {
			return c.json(
				{ error: `Invalid profile: ${(err as Error).message}` },
				400,
			);
		}

		const [existing] = await db
			.select()
			.from(schema.cryptoProfile)
			.where(eq(schema.cryptoProfile.fingerprint, fingerprint))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Profile not found" }, 404);
		}

		if (existing.userId !== user.id) {
			return c.json({ error: "Not authorized to update this profile" }, 403);
		}

		await db
			.update(schema.cryptoProfile)
			.set({ profileJws, updatedAt: now })
			.where(eq(schema.cryptoProfile.fingerprint, fingerprint));

		return c.json({ fingerprint, uri: `aspe:${fingerprint}` });
	}

	if (action === "delete") {
		const [existing] = await db
			.select()
			.from(schema.cryptoProfile)
			.where(eq(schema.cryptoProfile.fingerprint, fingerprint))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Profile not found" }, 404);
		}

		if (existing.userId !== user.id) {
			return c.json({ error: "Not authorized to delete this profile" }, 403);
		}

		// Cascade delete: sigchain links, attestations, usernames, then profile
		if (existing.identityId) {
			await db
				.delete(schema.sigchainLink)
				.where(eq(schema.sigchainLink.identityId, existing.identityId));
		}

		await db
			.delete(schema.attestation)
			.where(eq(schema.attestation.fingerprint, fingerprint));

		await db
			.delete(schema.username)
			.where(eq(schema.username.fingerprint, fingerprint));

		await db
			.delete(schema.cryptoProfile)
			.where(eq(schema.cryptoProfile.fingerprint, fingerprint));

		return c.json({ deleted: true });
	}

	return c.json({ error: "Unknown action" }, 400);
});

aspe.get("/api/identity/username/:username", async (c) => {
	const name = c.req.param("username").toLowerCase();
	const db = c.get("db");

	const [record] = await db
		.select()
		.from(schema.username)
		.where(eq(schema.username.username, name))
		.limit(1);

	if (!record) {
		return c.json({ error: "Username not found" }, 404);
	}

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, record.fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Profile not found" }, 404);
	}

	return c.json({
		username: name,
		fingerprint: record.fingerprint,
		profileJws: profile.profileJws,
	});
});

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

aspe.post("/api/identity/username/claim", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");
	const body = await c.req.json<{ username: string; fingerprint: string }>();

	const name = body.username?.toLowerCase();
	if (!name || !USERNAME_REGEX.test(name)) {
		return c.json(
			{
				error:
					"Username must be 3-32 lowercase alphanumeric characters or hyphens",
			},
			400,
		);
	}

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, body.fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Profile not found" }, 404);
	}

	if (profile.userId !== user.id) {
		return c.json({ error: "Not authorized for this profile" }, 403);
	}

	const [existing] = await db
		.select()
		.from(schema.username)
		.where(eq(schema.username.username, name))
		.limit(1);

	if (existing) {
		return c.json({ error: "Username already taken" }, 409);
	}

	await db.insert(schema.username).values({
		username: name,
		fingerprint: body.fingerprint,
		claimedAt: new Date(),
	});

	return c.json({ username: name, fingerprint: body.fingerprint }, 201);
});

aspe.post("/api/identity/username/release", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");
	const body = await c.req.json<{ fingerprint: string }>();

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, body.fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Profile not found" }, 404);
	}

	if (profile.userId !== user.id) {
		return c.json({ error: "Not authorized for this profile" }, 403);
	}

	const [existing] = await db
		.select()
		.from(schema.username)
		.where(eq(schema.username.fingerprint, body.fingerprint))
		.limit(1);

	if (!existing) {
		return c.json({ error: "No username to release" }, 404);
	}

	await db
		.delete(schema.username)
		.where(eq(schema.username.fingerprint, body.fingerprint));

	return c.json({ released: existing.username });
});

aspe.get("/api/identity/my-profile", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.userId, user.id))
		.limit(1);

	if (!profile) {
		return c.json({ error: "No profile found" }, 404);
	}

	const [un] = await db
		.select()
		.from(schema.username)
		.where(eq(schema.username.fingerprint, profile.fingerprint))
		.limit(1);

	return c.json({
		fingerprint: profile.fingerprint,
		profileJws: profile.profileJws,
		username: un?.username ?? null,
		createdAt: profile.createdAt,
		updatedAt: profile.updatedAt,
	});
});

// ── Email Attestation ────────────────────────────────────────────────────────

// Step 1: Generate challenge and send to user's verified email
aspe.post("/api/identity/email/challenge", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	if (!user.email || !user.emailVerified) {
		return c.json({ error: "No verified email on account" }, 400);
	}
	const db = c.get("db");

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.userId, user.id))
		.limit(1);

	if (!profile) {
		return c.json({ error: "No crypto profile found. Create a profile first." }, 404);
	}

	// Generate random challenge
	const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
	const challenge = Array.from(challengeBytes, (b) => b.toString(16).padStart(2, "0")).join("");

	const now = new Date();
	const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

	// Store challenge in verification table
	const verificationId = `identity-email:${profile.fingerprint}`;
	await db
		.insert(schema.verification)
		.values({
			id: verificationId,
			identifier: verificationId,
			value: challenge,
			expiresAt,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: schema.verification.id,
			set: { value: challenge, expiresAt, updatedAt: now },
		});

	// Send email via Resend
	if (!c.env.RESEND_API_KEY) {
		return c.json({ error: "Email service not configured" }, 500);
	}

	const { Resend } = await import("resend");
	const resend = new Resend(c.env.RESEND_API_KEY);
	const from = c.env.EMAIL_FROM || "Identity <noreply@wan0.net>";

	await resend.emails.send({
		from,
		to: [user.email],
		subject: "Identity Email Verification Challenge",
		html: `
			<p>You requested to link <strong>${user.email}</strong> to your cryptographic identity.</p>
			<p>Sign this challenge with your identity key to prove ownership:</p>
			<pre style="background: #f4f4f4; padding: 16px; border-radius: 8px; font-family: monospace; word-break: break-all;">${challenge}</pre>
			<p>This challenge expires in 15 minutes.</p>
			<p style="color: #888; font-size: 12px;">If you did not request this, ignore this email.</p>
		`,
	});

	return c.json({ challenge, email: user.email, expiresAt: expiresAt.toISOString() });
});

// Step 2: Verify signed challenge and create attestation
aspe.post("/api/identity/email/verify", requireAuth, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);
	const db = c.get("db");

	const body = await c.req.json<{ signedChallenge: string }>();
	if (!body.signedChallenge) {
		return c.json({ error: "signedChallenge required" }, 400);
	}

	// Parse the JWS to extract the challenge and signer's key
	let header;
	try {
		header = decodeProtectedHeader(body.signedChallenge);
	} catch {
		return c.json({ error: "Invalid JWS format" }, 400);
	}

	if (!header.jwk || typeof header.jwk !== "object" || typeof header.kid !== "string") {
		return c.json({ error: "JWS must include jwk and kid in header" }, 400);
	}

	// Verify the signature
	let payload: Uint8Array;
	try {
		const key = await importJWK(header.jwk as JWK, "EdDSA");
		const result = await compactVerify(body.signedChallenge, key);
		payload = result.payload;
	} catch {
		return c.json({ error: "Signature verification failed" }, 400);
	}

	// Verify fingerprint matches the kid
	const fingerprint = await computeFingerprint(header.jwk as JsonWebKey);
	if (fingerprint !== header.kid) {
		return c.json({ error: "Fingerprint mismatch" }, 400);
	}

	// Verify the signer owns a profile belonging to this user
	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, fingerprint))
		.limit(1);

	if (!profile || profile.userId !== user.id) {
		return c.json({ error: "Profile not found or not owned by this user" }, 403);
	}

	// Extract and verify the challenge
	const signedChallenge = new TextDecoder().decode(payload);
	const verificationId = `identity-email:${fingerprint}`;

	const [verification] = await db
		.select()
		.from(schema.verification)
		.where(eq(schema.verification.id, verificationId))
		.limit(1);

	if (!verification) {
		return c.json({ error: "No pending challenge found. Request a new one." }, 400);
	}

	if (verification.expiresAt < new Date()) {
		return c.json({ error: "Challenge expired. Request a new one." }, 400);
	}

	if (verification.value !== signedChallenge) {
		return c.json({ error: "Challenge does not match" }, 400);
	}

	// Challenge verified — create attestation
	const now = new Date();

	await db
		.insert(schema.attestation)
		.values({
			id: `email_${fingerprint}`,
			fingerprint,
			type: "email",
			value: user.email!,
			attestedBy: "login2.link42.app",
			attestedAt: now,
			expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
		})
		.onConflictDoUpdate({
			target: schema.attestation.id,
			set: {
				value: user.email!,
				attestedAt: now,
				expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
			},
		});

	// Clean up used challenge
	await db.delete(schema.verification).where(eq(schema.verification.id, verificationId));

	return c.json({
		fingerprint,
		email: user.email,
		attestedAt: now.toISOString(),
	});
});

aspe.get("/api/identity/verify-email/:fingerprint", async (c) => {
	const fingerprint = c.req.param("fingerprint");
	const email = c.req.query("email");
	const db = c.get("db");

	if (!email) {
		return c.json({ error: "email query parameter required" }, 400);
	}

	const [att] = await db
		.select()
		.from(schema.attestation)
		.where(
			and(
				eq(schema.attestation.fingerprint, fingerprint),
				eq(schema.attestation.type, "email"),
			),
		)
		.limit(1);

	if (!att) {
		return c.json({ attested: false });
	}

	return c.json({
		attested: att.value === email,
		attestedAt: att.attestedAt,
	});
});

// ── General Attestation Endpoints ─────────────────────────────────────────────

aspe.get("/api/identity/attestations/:fingerprint", async (c) => {
	const fingerprint = c.req.param("fingerprint");
	const db = c.get("db");

	const now = new Date();
	const attestations = await db
		.select()
		.from(schema.attestation)
		.where(eq(schema.attestation.fingerprint, fingerprint));

	// Filter out expired attestations
	const active = attestations.filter((a) => !a.expiresAt || a.expiresAt > now);

	return c.json({
		attestations: active.map((a) => ({
			id: a.id,
			type: a.type,
			platform: a.platform,
			platformUsername: a.platformUsername,
			value: a.value,
			attestedBy: a.attestedBy,
			attestedAt: a.attestedAt,
			expiresAt: a.expiresAt,
		})),
	});
});

aspe.post("/api/identity/attest-bot", async (c) => {
	const db = c.get("db");
	const body = await c.req.json<{
		fingerprint: string;
		platform: string;
		platformUserId: string;
		platformUsername: string;
		apiKey: string;
	}>();

	if (!body.apiKey || body.apiKey !== c.env.BOT_API_KEY) {
		return c.json({ error: "Invalid API key" }, 401);
	}

	if (
		!body.fingerprint ||
		!body.platform ||
		!body.platformUserId ||
		!body.platformUsername
	) {
		return c.json(
			{
				error:
					"Missing required fields: fingerprint, platform, platformUserId, platformUsername",
			},
			400,
		);
	}

	const [profile] = await db
		.select()
		.from(schema.cryptoProfile)
		.where(eq(schema.cryptoProfile.fingerprint, body.fingerprint))
		.limit(1);

	if (!profile) {
		return c.json({ error: "Crypto profile not found" }, 404);
	}

	const now = new Date();
	const id = `${body.platform}_${body.fingerprint}`;

	await db
		.insert(schema.attestation)
		.values({
			id,
			fingerprint: body.fingerprint,
			type: body.platform,
			platform: body.platform,
			platformUserId: body.platformUserId,
			platformUsername: body.platformUsername,
			value: body.platformUsername,
			attestedBy: "login2.link42.app",
			attestedAt: now,
		})
		.onConflictDoUpdate({
			target: schema.attestation.id,
			set: {
				platformUserId: body.platformUserId,
				platformUsername: body.platformUsername,
				value: body.platformUsername,
				attestedAt: now,
			},
		});

	return c.json(
		{
			id,
			fingerprint: body.fingerprint,
			platform: body.platform,
			platformUsername: body.platformUsername,
		},
		201,
	);
});

aspe.get(
	"/api/identity/attestation-status/:fingerprint/:platform",
	async (c) => {
		const fingerprint = c.req.param("fingerprint");
		const platform = c.req.param("platform");
		const db = c.get("db");

		const now = new Date();
		const [att] = await db
			.select()
			.from(schema.attestation)
			.where(
				and(
					eq(schema.attestation.fingerprint, fingerprint),
					eq(schema.attestation.type, platform),
				),
			)
			.limit(1);

		if (!att || (att.expiresAt && att.expiresAt <= now)) {
			return c.json({ attested: false });
		}

		return c.json({
			attested: true,
			platformUsername: att.platformUsername,
			attestedAt: att.attestedAt,
		});
	},
);

export { aspe as aspeRoutes };
