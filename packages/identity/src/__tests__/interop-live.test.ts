/**
 * Live interoperability tests against Keyoxide's ASPE server (aspe-server-rs).
 *
 * These tests require a running ASPE server. In CI, this is provided by
 * the keyoxide/aspe-server Docker container. Locally, run:
 *
 *   docker run -d -p 3000:3000 -e ASPE_DOMAIN=localhost:3000 \
 *     codeberg.org/keyoxide/aspe-server:latest
 *
 * Set ASPE_TEST_URL=http://localhost:3000 to enable these tests.
 * They are skipped when the server is not available.
 */
import { describe, expect, it, beforeAll } from "vitest";
import {
	computeFingerprint,
	createProfile,
	createRequest,
	generateIdentityKey,
	parseProfile,
} from "../index.js";

const ASPE_URL = process.env.ASPE_TEST_URL || "http://localhost:3000";

let serverAvailable = false;

beforeAll(async () => {
	try {
		const res = await fetch(`${ASPE_URL}/.well-known/aspe/version`, {
			signal: AbortSignal.timeout(2000),
		});
		serverAvailable = res.ok;
		if (serverAvailable) {
			const version = await res.text();
			console.log(`ASPE test server available: ${version.trim()}`);
		}
	} catch {
		console.log("ASPE test server not available — skipping live interop tests");
	}
});

describe("live ASPE interop (keyoxide aspe-server-rs)", () => {
	it.skipIf(!serverAvailable)("upload profile via ASPE POST and fetch it back", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		// Create a profile
		const profileJws = await createProfile({
			name: "trust0 interop test",
			claims: ["https://example.com/test-proof"],
			description: "Testing trust0 ↔ Keyoxide ASPE interop",
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		// Create ASPE request JWS (create action)
		const requestJws = await createRequest({
			action: "create",
			profileJws,
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		// Upload to Keyoxide's ASPE server
		const uploadRes = await fetch(`${ASPE_URL}/.well-known/aspe/post/`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: requestJws,
		});

		expect(uploadRes.ok).toBe(true);

		// Fetch it back
		const fetchRes = await fetch(
			`${ASPE_URL}/.well-known/aspe/id/${fingerprint}`,
		);

		expect(fetchRes.ok).toBe(true);

		const fetchedJws = await fetchRes.text();

		// Verify the fetched profile matches what we uploaded
		const parsed = await parseProfile(fetchedJws);
		expect(parsed.name).toBe("trust0 interop test");
		expect(parsed.claims).toEqual(["https://example.com/test-proof"]);
		expect(parsed.description).toBe("Testing trust0 ↔ Keyoxide ASPE interop");
		expect(parsed.fingerprint).toBe(fingerprint);
	});

	it.skipIf(!serverAvailable)("update profile via ASPE POST", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		// Create initial profile
		const profile1 = await createProfile({
			name: "Original Name",
			claims: [],
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const createReq = await createRequest({
			action: "create",
			profileJws: profile1,
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const createRes = await fetch(`${ASPE_URL}/.well-known/aspe/post/`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: createReq,
		});
		expect(createRes.ok).toBe(true);

		// Update the profile
		const profile2 = await createProfile({
			name: "Updated Name",
			claims: ["https://github.com/test"],
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const updateReq = await createRequest({
			action: "update",
			profileJws: profile2,
			aspeUri: `aspe:localhost:3000:${fingerprint}`,
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const updateRes = await fetch(`${ASPE_URL}/.well-known/aspe/post/`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: updateReq,
		});
		expect(updateRes.ok).toBe(true);

		// Fetch and verify update
		const fetchRes = await fetch(`${ASPE_URL}/.well-known/aspe/id/${fingerprint}`);
		const fetched = await parseProfile(await fetchRes.text());
		expect(fetched.name).toBe("Updated Name");
		expect(fetched.claims).toEqual(["https://github.com/test"]);
	});

	it.skipIf(!serverAvailable)("delete profile via ASPE POST", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		// Create
		const profile = await createProfile({
			name: "To Delete",
			claims: [],
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const createReq = await createRequest({
			action: "create",
			profileJws: profile,
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		await fetch(`${ASPE_URL}/.well-known/aspe/post/`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: createReq,
		});

		// Verify it exists
		const existsRes = await fetch(`${ASPE_URL}/.well-known/aspe/id/${fingerprint}`);
		expect(existsRes.ok).toBe(true);

		// Delete
		const deleteReq = await createRequest({
			action: "delete",
			aspeUri: `aspe:localhost:3000:${fingerprint}`,
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const deleteRes = await fetch(`${ASPE_URL}/.well-known/aspe/post/`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: deleteReq,
		});
		expect(deleteRes.ok).toBe(true);

		// Verify it's gone
		const goneRes = await fetch(`${ASPE_URL}/.well-known/aspe/id/${fingerprint}`);
		expect(goneRes.ok).toBe(false);
	});

	it.skipIf(!serverAvailable)("reject profile signed by different key", async () => {
		const key1 = await generateIdentityKey();
		const key2 = await generateIdentityKey();
		const fp1 = await computeFingerprint(key1.publicJWK);

		// Create profile with key1
		const profile = await createProfile({
			name: "Legit",
			claims: [],
			key: key1.privateKey,
			publicJWK: key1.publicJWK,
			fingerprint: fp1,
		});

		// Try to upload with a request signed by key2 (should fail)
		const fp2 = await computeFingerprint(key2.publicJWK);
		const fakeReq = await createRequest({
			action: "create",
			profileJws: profile,
			key: key2.privateKey,
			publicJWK: key2.publicJWK,
			fingerprint: fp2,
		});

		const res = await fetch(`${ASPE_URL}/.well-known/aspe/post/`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: fakeReq,
		});

		// Should fail — request fingerprint doesn't match profile fingerprint
		expect(res.ok).toBe(false);
	});

	it.skipIf(!serverAvailable)("version endpoint returns server info", async () => {
		const res = await fetch(`${ASPE_URL}/.well-known/aspe/version`);
		expect(res.ok).toBe(true);
		const text = await res.text();
		expect(text.length).toBeGreaterThan(0);
	});
});
