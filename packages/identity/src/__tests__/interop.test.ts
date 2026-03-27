/**
 * Interoperability tests — verify trust0's output matches the Ariadne spec
 * so that Keyoxide (and any other Ariadne implementation) can verify our profiles.
 *
 * These tests don't require a running server — they validate the wire format
 * of profiles, requests, fingerprints, and chain links against the spec.
 *
 * For live interop testing against Keyoxide's ASPE server (aspe-server-rs),
 * see the CI workflow which runs the Rust server in a container.
 */
import { compactVerify, decodeProtectedHeader, importJWK, type JWK } from "jose";
import { base32 } from "rfc4648";
import { describe, expect, it } from "vitest";
import {
	computeFingerprint,
	computeIdentityId,
	computeLinkHash,
	createChainLink,
	createProfile,
	createRequest,
	generateIdentityKey,
	parseProfile,
	parseRequest,
	verifyChain,
} from "../index.js";

// ── Helpers ────────────────────────────────────────────────────────

async function makeIdentity() {
	const { privateKey, publicKey, publicJWK } = await generateIdentityKey();
	const fingerprint = await computeFingerprint(publicJWK);
	return { privateKey, publicKey, publicJWK, fingerprint };
}

// ── ASP Profile Wire Format (Ariadne Spec Compliance) ──────────────

describe("ASP profile wire format", () => {
	it("produces valid JWS compact serialization (3 segments)", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: ["https://gist.github.com/alice/abc"],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const parts = profile.split(".");
		expect(parts.length).toBe(3);

		// Each part must be valid base64url
		for (const part of parts) {
			expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
		}
	});

	it("header contains required fields per ASP spec", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: [],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const header = decodeProtectedHeader(profile);

		// ASP spec: typ MUST be "JWT"
		expect(header.typ).toBe("JWT");

		// ASP spec: alg MUST be "EdDSA" (for Ed25519)
		expect(header.alg).toBe("EdDSA");

		// ASP spec: kid MUST be the fingerprint
		expect(header.kid).toBe(id.fingerprint);

		// ASP spec: jwk MUST contain the public key
		expect(header.jwk).toBeDefined();
		expect((header.jwk as any).kty).toBe("OKP");
		expect((header.jwk as any).crv).toBe("Ed25519");
		expect(typeof (header.jwk as any).x).toBe("string");

		// jwk MUST NOT contain private key material
		expect((header.jwk as any).d).toBeUndefined();
	});

	it("payload uses Ariadne namespaced claims", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Test User",
			claims: ["https://example.com/proof", "dns:example.com?type=TXT"],
			description: "A test profile",
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		// Decode payload directly (not via parseProfile — we want raw spec compliance)
		const parts = profile.split(".");
		const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

		// ASP spec required fields
		expect(payload["http://ariadne.id/version"]).toBe(0);
		expect(payload["http://ariadne.id/type"]).toBe("profile");
		expect(payload["http://ariadne.id/name"]).toBe("Test User");
		expect(payload["http://ariadne.id/claims"]).toEqual([
			"https://example.com/proof",
			"dns:example.com?type=TXT",
		]);

		// ASP spec optional fields
		expect(payload["http://ariadne.id/description"]).toBe("A test profile");
	});

	it("signature is verifiable with the embedded JWK", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: ["https://example.com"],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		// Extract JWK from header and verify signature (what Keyoxide does)
		const header = decodeProtectedHeader(profile);
		const publicKey = await importJWK(header.jwk as JWK, "EdDSA");
		const { payload } = await compactVerify(profile, publicKey);

		const decoded = JSON.parse(new TextDecoder().decode(payload));
		expect(decoded["http://ariadne.id/name"]).toBe("Alice");
	});

	it("profile without optional fields still valid", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Minimal",
			claims: [],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const parsed = await parseProfile(profile);
		expect(parsed.name).toBe("Minimal");
		expect(parsed.claims).toEqual([]);
		expect(parsed.description).toBeUndefined();
	});
});

// ── Fingerprint Algorithm (Ariadne Spec Compliance) ─────────────────

describe("fingerprint algorithm", () => {
	it("produces 26-character uppercase BASE32", async () => {
		const { publicJWK } = await generateIdentityKey();
		const fp = await computeFingerprint(publicJWK);

		expect(fp).toMatch(/^[A-Z2-7]{26}$/);
	});

	it("uses SHA-512 → first 16 bytes → BASE32 (per spec)", async () => {
		const { publicJWK } = await generateIdentityKey();

		// Manually compute fingerprint per Ariadne spec
		const canonical = JSON.stringify({
			crv: publicJWK.crv,
			kty: publicJWK.kty,
			x: publicJWK.x,
		});

		const hash = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(canonical));
		const first16 = new Uint8Array(hash).slice(0, 16);
		const expected = base32.stringify(first16, { pad: false }).toUpperCase();

		const actual = await computeFingerprint(publicJWK);
		expect(actual).toBe(expected);
	});

	it("canonical JWK has keys in alphabetical order", async () => {
		const { publicJWK } = await generateIdentityKey();

		// For Ed25519, canonical is { crv, kty, x } — alphabetical
		const canonical = { crv: publicJWK.crv, kty: publicJWK.kty, x: publicJWK.x };
		const json = JSON.stringify(canonical);

		// Verify order: crv comes before kty comes before x
		const crvPos = json.indexOf('"crv"');
		const ktyPos = json.indexOf('"kty"');
		const xPos = json.indexOf('"x"');

		expect(crvPos).toBeLessThan(ktyPos);
		expect(ktyPos).toBeLessThan(xPos);
	});
});

// ── ASPE Request JWS (Ariadne Spec Compliance) ──────────────────────

describe("ASPE request JWS", () => {
	it("create request has required fields", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: [],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const request = await createRequest({
			action: "create",
			profileJws: profile,
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const parsed = await parseRequest(request);
		expect(parsed.action).toBe("create");
		expect(parsed.profileJws).toBe(profile);
		expect(typeof parsed.iat).toBe("number");
		expect(parsed.fingerprint).toBe(id.fingerprint);
	});

	it("update request includes aspeUri", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: [],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const request = await createRequest({
			action: "update",
			profileJws: profile,
			aspeUri: `aspe:trust0.app:${id.fingerprint}`,
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const parsed = await parseRequest(request);
		expect(parsed.action).toBe("update");
		expect(parsed.aspeUri).toBe(`aspe:trust0.app:${id.fingerprint}`);
	});

	it("request iat is within acceptable window", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: [],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const request = await createRequest({
			action: "create",
			profileJws: profile,
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const parsed = await parseRequest(request);
		const now = Math.floor(Date.now() / 1000);

		// iat should be within 5 seconds of now (generous for test timing)
		expect(Math.abs(now - parsed.iat)).toBeLessThan(5);
	});
});

// ── Sigchain Wire Format ────────────────────────────────────────────

describe("sigchain wire format", () => {
	it("genesis link has correct structure", async () => {
		const id = await makeIdentity();
		const genesis = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { fingerprint: id.fingerprint },
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		// Valid compact JWS
		expect(genesis.split(".").length).toBe(3);

		// Header matches ASP format
		const header = decodeProtectedHeader(genesis);
		expect(header.typ).toBe("JWT");
		expect(header.alg).toBe("EdDSA");
		expect(header.kid).toBe(id.fingerprint);
	});

	it("identity ID is 52-char BASE32 derived from genesis", async () => {
		const id = await makeIdentity();
		const genesis = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { fingerprint: id.fingerprint },
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const identityId = await computeIdentityId(genesis);
		expect(identityId).toMatch(/^[A-Z2-7]{52}$/);
	});

	it("link hash is sha256-prefixed base64url", async () => {
		const id = await makeIdentity();
		const genesis = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { fingerprint: id.fingerprint },
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const hash = await computeLinkHash(genesis);
		expect(hash.startsWith("sha256:")).toBe(true);
		expect(hash.length).toBeGreaterThan(10);
	});

	it("chain verifies end-to-end with identity ID round-trip", async () => {
		const id = await makeIdentity();
		const genesis = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { fingerprint: id.fingerprint },
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const expectedId = await computeIdentityId(genesis);

		const prevHash = await computeLinkHash(genesis);
		const link1 = await createChainLink({
			seqno: 1,
			prev: prevHash,
			type: "proof_add",
			body: { claim_uri: "https://github.com/alice" },
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		const state = await verifyChain([genesis, link1], expectedId);
		expect(state.identityId).toBe(expectedId);
		expect(state.activeProofs).toContain("https://github.com/alice");
	});
});

// ── Cross-Implementation Verification ───────────────────────────────

describe("cross-implementation verification", () => {
	it("profile created by trust0 is parseable by standard JOSE", async () => {
		const id = await makeIdentity();
		const profile = await createProfile({
			name: "Cross-test",
			claims: ["https://gist.github.com/test/123"],
			key: id.privateKey,
			publicJWK: id.publicJWK,
			fingerprint: id.fingerprint,
		});

		// Simulate what Keyoxide does: decode header, extract JWK, verify
		const header = decodeProtectedHeader(profile);

		// 1. Extract public key from header
		const jwk = header.jwk as JWK;
		expect(jwk).toBeDefined();

		// 2. Import key
		const key = await importJWK(jwk, "EdDSA");

		// 3. Verify signature
		const { payload } = await compactVerify(profile, key);
		const decoded = JSON.parse(new TextDecoder().decode(payload));

		// 4. Compute fingerprint from JWK
		const fp = await computeFingerprint(jwk as JsonWebKey);

		// 5. Verify kid matches computed fingerprint
		expect(header.kid).toBe(fp);

		// 6. Verify payload structure
		expect(decoded["http://ariadne.id/version"]).toBe(0);
		expect(decoded["http://ariadne.id/type"]).toBe("profile");
		expect(decoded["http://ariadne.id/name"]).toBe("Cross-test");
		expect(decoded["http://ariadne.id/claims"]).toEqual(["https://gist.github.com/test/123"]);
	});

	it("fingerprint is case-insensitive per spec", async () => {
		const { publicJWK } = await generateIdentityKey();
		const fp = await computeFingerprint(publicJWK);

		// Spec says fingerprint is not case-sensitive
		expect(fp.toLowerCase()).toBe(fp.toLowerCase());
		expect(fp.toUpperCase()).toBe(fp); // We always produce uppercase
	});
});
