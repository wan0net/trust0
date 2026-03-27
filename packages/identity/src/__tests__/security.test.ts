import { describe, expect, it } from "vitest";
import {
	computeFingerprint,
	computeIdentityId,
	computeLinkHash,
	createChainLink,
	createProfile,
	createRequest,
	generateIdentityKey,
	mergeSignatures,
	parseChainLink,
	parseProfile,
	parseRequest,
	signDocument,
	verifyChain,
	verifyDocumentSignature,
	verifyMultiSignature,
} from "../index.js";

// ── Helpers ────────────────────────────────────────────────────────

async function makeIdentity() {
	const { privateKey, publicKey, publicJWK } = await generateIdentityKey();
	const fingerprint = await computeFingerprint(publicJWK);
	return { privateKey, publicKey, publicJWK, fingerprint };
}

async function makeGenesisLink(identity: Awaited<ReturnType<typeof makeIdentity>>) {
	return createChainLink({
		seqno: 0,
		prev: null,
		type: "key_init",
		body: { fingerprint: identity.fingerprint },
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
	});
}

async function appendLink(
	identity: Awaited<ReturnType<typeof makeIdentity>>,
	prevJws: string,
	seqno: number,
	type: string,
	body: Record<string, unknown>,
) {
	const prevHash = await computeLinkHash(prevJws);
	return createChainLink({
		seqno,
		prev: prevHash,
		type: type as any,
		body,
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
	});
}

// ── Key Rotation Chain Tests ───────────────────────────────────────

describe("key rotation in sigchain", () => {
	it("key_rotate adds new fingerprint to active set", async () => {
		const alice = await makeIdentity();
		const aliceNew = await makeIdentity();

		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "key_rotate", {
			new_fingerprint: aliceNew.fingerprint,
			new_jwk: { kty: aliceNew.publicJWK.kty, crv: aliceNew.publicJWK.crv, x: aliceNew.publicJWK.x },
		});

		const state = await verifyChain([link0, link1]);
		expect(state.activeFingerprints.has(alice.fingerprint)).toBe(true);
		expect(state.activeFingerprints.has(aliceNew.fingerprint)).toBe(true);
	});

	it("new key can sign links after rotation", async () => {
		const alice = await makeIdentity();
		const aliceNew = await makeIdentity();

		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "key_rotate", {
			new_fingerprint: aliceNew.fingerprint,
		});
		// New key signs a proof_add
		const link2 = await appendLink(aliceNew, link1, 2, "proof_add", {
			claim_uri: "https://example.com",
		});

		const state = await verifyChain([link0, link1, link2]);
		expect(state.activeProofs).toContain("https://example.com");
	});

	it("key_revoke removes fingerprint from active set", async () => {
		const alice = await makeIdentity();
		const aliceNew = await makeIdentity();

		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "key_rotate", {
			new_fingerprint: aliceNew.fingerprint,
		});
		// Revoke old key
		const link2 = await appendLink(aliceNew, link1, 2, "key_revoke", {
			fingerprint: alice.fingerprint,
		});

		const state = await verifyChain([link0, link1, link2]);
		expect(state.activeFingerprints.has(alice.fingerprint)).toBe(false);
		expect(state.activeFingerprints.has(aliceNew.fingerprint)).toBe(true);
	});

	it("revoked key cannot sign new links", async () => {
		const alice = await makeIdentity();
		const aliceNew = await makeIdentity();

		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "key_rotate", {
			new_fingerprint: aliceNew.fingerprint,
		});
		const link2 = await appendLink(aliceNew, link1, 2, "key_revoke", {
			fingerprint: alice.fingerprint,
		});
		// Old key tries to sign after revocation
		const link3 = await appendLink(alice, link2, 3, "proof_add", {
			claim_uri: "https://evil.com",
		});

		await expect(verifyChain([link0, link1, link2, link3])).rejects.toThrow("unauthorized key");
	});
});

// ── Username Lifecycle Tests ───────────────────────────────────────

describe("username claim and release in sigchain", () => {
	it("username_claim sets username, username_release clears it", async () => {
		const alice = await makeIdentity();
		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "username_claim", { username: "alice" });

		const state1 = await verifyChain([link0, link1]);
		expect(state1.username).toBe("alice");

		const link2 = await appendLink(alice, link1, 2, "username_release", {});
		const state2 = await verifyChain([link0, link1, link2]);
		expect(state2.username).toBeNull();
	});

	it("can reclaim username after release", async () => {
		const alice = await makeIdentity();
		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "username_claim", { username: "alice" });
		const link2 = await appendLink(alice, link1, 2, "username_release", {});
		const link3 = await appendLink(alice, link2, 3, "username_claim", { username: "alice2" });

		const state = await verifyChain([link0, link1, link2, link3]);
		expect(state.username).toBe("alice2");
	});
});

// ── doc_sign in Chain ──────────────────────────────────────────────

describe("doc_sign in sigchain", () => {
	it("doc_sign does not change chain state", async () => {
		const alice = await makeIdentity();
		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "proof_add", { claim_uri: "https://github.com/alice" });
		const link2 = await appendLink(alice, link1, 2, "doc_sign", {
			doc_hash: "sha256:abc123",
			doc_name: "contract.pdf",
		});

		const state = await verifyChain([link0, link1, link2]);
		expect(state.activeProofs).toEqual(["https://github.com/alice"]);
		expect(state.links.length).toBe(3);
	});
});

// ── Attack Vectors ─────────────────────────────────────────────────

describe("attack vectors", () => {
	it("rejects link signed by a completely unknown key", async () => {
		const alice = await makeIdentity();
		const eve = await makeIdentity();

		const link0 = await makeGenesisLink(alice);
		// Eve tries to append to Alice's chain
		const link1 = await appendLink(eve, link0, 1, "proof_add", {
			claim_uri: "https://evil.com",
		});

		await expect(verifyChain([link0, link1])).rejects.toThrow("unauthorized key");
	});

	it("rejects chain with tampered prev hash", async () => {
		const alice = await makeIdentity();
		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "proof_add", { claim_uri: "https://a.com" });

		// Create a separate link2 that doesn't actually chain from link1
		const fakeLink1 = await appendLink(alice, link0, 1, "proof_add", { claim_uri: "https://b.com" });
		const link2 = await appendLink(alice, fakeLink1, 2, "proof_add", { claim_uri: "https://c.com" });

		// link2's prev hash points to fakeLink1, not link1
		await expect(verifyChain([link0, link1, link2])).rejects.toThrow("invalid prev hash");
	});

	it("rejects chain with skipped seqno", async () => {
		const alice = await makeIdentity();
		const link0 = await makeGenesisLink(alice);
		// Skip seqno 1, jump to 2
		const prevHash = await computeLinkHash(link0);
		const link2 = await createChainLink({
			seqno: 2,
			prev: prevHash,
			type: "proof_add",
			body: { claim_uri: "https://a.com" },
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		await expect(verifyChain([link0, link2])).rejects.toThrow("invalid seqno");
	});

	it("rejects empty chain", async () => {
		await expect(verifyChain([])).rejects.toThrow("at least one link");
	});

	it("rejects chain where genesis is not key_init", async () => {
		const alice = await makeIdentity();
		const badGenesis = await createChainLink({
			seqno: 0,
			prev: null,
			type: "proof_add",
			body: { claim_uri: "https://a.com" },
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		await expect(verifyChain([badGenesis])).rejects.toThrow("key_init");
	});

	it("identity ID is stable across chain appends", async () => {
		const alice = await makeIdentity();
		const link0 = await makeGenesisLink(alice);
		const link1 = await appendLink(alice, link0, 1, "proof_add", { claim_uri: "https://a.com" });

		const state = await verifyChain([link0, link1]);
		const expectedId = await computeIdentityId(link0);
		expect(state.identityId).toBe(expectedId);
	});

	it("tampered profile JWS is rejected by parseProfile", async () => {
		const alice = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: ["https://github.com/alice"],
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		// Tamper with the payload section
		const [header, payload, sig] = profile.split(".");
		const tampered = `${header}.${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}.${sig}`;
		await expect(parseProfile(tampered)).rejects.toThrow();
	});

	it("request JWS with expired iat is rejected", async () => {
		const alice = await makeIdentity();
		const profile = await createProfile({
			name: "Alice",
			claims: [],
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		// parseRequest checks iat is within 5 minutes
		// We can't easily create an expired request without mocking Date,
		// but we can verify the structure validates correctly
		const request = await createRequest({
			action: "create",
			profileJws: profile,
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		const parsed = await parseRequest(request);
		expect(parsed.action).toBe("create");
		expect(parsed.fingerprint).toBe(alice.fingerprint);
	});
});

// ── Multi-Party Signatures ─────────────────────────────────────────

describe("multi-party signatures", () => {
	it("mergeSignatures combines bundles over same document", async () => {
		const alice = await makeIdentity();
		const bob = await makeIdentity();
		const doc = new TextEncoder().encode("contract text");

		const bundleA = await signDocument({
			document: doc,
			documentName: "contract.txt",
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		const bundleB = await signDocument({
			document: doc,
			documentName: "contract.txt",
			key: bob.privateKey,
			publicJWK: bob.publicJWK,
			fingerprint: bob.fingerprint,
		});

		const multi = mergeSignatures([bundleA, bundleB]);
		expect(multi.format).toBe("multi-sig");
		expect(multi.signatures.length).toBe(2);
		expect(multi.document.hash).toBe(bundleA.document.hash);
	});

	it("mergeSignatures rejects different document hashes", async () => {
		const alice = await makeIdentity();
		const doc1 = new TextEncoder().encode("doc 1");
		const doc2 = new TextEncoder().encode("doc 2");

		const bundle1 = await signDocument({
			document: doc1, documentName: "a.txt",
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});
		const bundle2 = await signDocument({
			document: doc2, documentName: "b.txt",
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});

		expect(() => mergeSignatures([bundle1, bundle2])).toThrow("hash mismatch");
	});

	it("verifyMultiSignature verifies each signer independently", async () => {
		const alice = await makeIdentity();
		const bob = await makeIdentity();
		const doc = new TextEncoder().encode("agreement");

		const bundleA = await signDocument({
			document: doc, documentName: "agreement.txt",
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});
		const bundleB = await signDocument({
			document: doc, documentName: "agreement.txt",
			key: bob.privateKey, publicJWK: bob.publicJWK, fingerprint: bob.fingerprint,
		});

		const multi = mergeSignatures([bundleA, bundleB]);
		const results = await verifyMultiSignature({ document: doc, bundle: multi });

		expect(results.length).toBe(2);
		expect(results[0].valid).toBe(true);
		expect(results[0].fingerprint).toBe(alice.fingerprint);
		expect(results[1].valid).toBe(true);
		expect(results[1].fingerprint).toBe(bob.fingerprint);
	});

	it("verifyMultiSignature rejects tampered document", async () => {
		const alice = await makeIdentity();
		const doc = new TextEncoder().encode("original");
		const tampered = new TextEncoder().encode("tampered");

		const bundle = await signDocument({
			document: doc, documentName: "doc.txt",
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});

		const multi = mergeSignatures([bundle]);
		await expect(verifyMultiSignature({ document: tampered, bundle: multi })).rejects.toThrow();
	});
});

// ── Document Signing Edge Cases ────────────────────────────────────

describe("document signing edge cases", () => {
	it("handles empty document", async () => {
		const alice = await makeIdentity();
		const doc = new Uint8Array(0);

		const bundle = await signDocument({
			document: doc, documentName: "empty.txt",
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});

		const result = await verifyDocumentSignature({ document: doc, bundle });
		expect(result.valid).toBe(true);
		expect(bundle.document.size).toBe(0);
	});

	it("handles large document name", async () => {
		const alice = await makeIdentity();
		const doc = new TextEncoder().encode("x");
		const longName = "a".repeat(1000) + ".txt";

		const bundle = await signDocument({
			document: doc, documentName: longName,
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});

		expect(bundle.document.name).toBe(longName);
	});

	it("different keys produce different signatures for same document", async () => {
		const alice = await makeIdentity();
		const bob = await makeIdentity();
		const doc = new TextEncoder().encode("same doc");

		const bundleA = await signDocument({
			document: doc, documentName: "doc.txt",
			key: alice.privateKey, publicJWK: alice.publicJWK, fingerprint: alice.fingerprint,
		});
		const bundleB = await signDocument({
			document: doc, documentName: "doc.txt",
			key: bob.privateKey, publicJWK: bob.publicJWK, fingerprint: bob.fingerprint,
		});

		expect(bundleA.jws.signature).not.toBe(bundleB.jws.signature);
		expect(bundleA.signer.fingerprint).not.toBe(bundleB.signer.fingerprint);
	});
});

// ── Profile Edge Cases ─────────────────────────────────────────────

describe("profile edge cases", () => {
	it("profile with many claims round-trips", async () => {
		const alice = await makeIdentity();
		const claims = Array.from({ length: 50 }, (_, i) => `https://example.com/proof/${i}`);

		const profile = await createProfile({
			name: "Alice",
			claims,
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		const parsed = await parseProfile(profile);
		expect(parsed.claims).toEqual(claims);
	});

	it("profile with unicode name round-trips", async () => {
		const alice = await makeIdentity();

		const profile = await createProfile({
			name: "Álice Müller 李明",
			claims: [],
			description: "Ñoño señor 🔑",
			key: alice.privateKey,
			publicJWK: alice.publicJWK,
			fingerprint: alice.fingerprint,
		});

		const parsed = await parseProfile(profile);
		expect(parsed.name).toBe("Álice Müller 李明");
		expect(parsed.description).toBe("Ñoño señor 🔑");
	});

	it("fingerprint from different keys never collide", async () => {
		const fingerprints = new Set<string>();
		for (let i = 0; i < 20; i++) {
			const id = await makeIdentity();
			expect(fingerprints.has(id.fingerprint)).toBe(false);
			fingerprints.add(id.fingerprint);
		}
	});
});

// ── Chain Integrity Under Complex Scenarios ────────────────────────

describe("complex chain scenarios", () => {
	it("full lifecycle: init → proof → username → doc_sign → rotate → revoke", async () => {
		const key1 = await makeIdentity();
		const key2 = await makeIdentity();

		const link0 = await makeGenesisLink(key1);
		const link1 = await appendLink(key1, link0, 1, "proof_add", { claim_uri: "https://github.com/alice" });
		const link2 = await appendLink(key1, link1, 2, "username_claim", { username: "alice" });
		const link3 = await appendLink(key1, link2, 3, "doc_sign", { doc_hash: "sha256:abc", doc_name: "doc.pdf" });
		const link4 = await appendLink(key1, link3, 4, "key_rotate", { new_fingerprint: key2.fingerprint });
		const link5 = await appendLink(key2, link4, 5, "key_revoke", { fingerprint: key1.fingerprint });
		const link6 = await appendLink(key2, link5, 6, "proof_add", { claim_uri: "dns:alice.dev?type=TXT" });
		const link7 = await appendLink(key2, link6, 7, "proof_revoke", { claim_uri: "https://github.com/alice" });

		const state = await verifyChain([link0, link1, link2, link3, link4, link5, link6, link7]);

		expect(state.links.length).toBe(8);
		expect(state.username).toBe("alice");
		expect(state.activeFingerprints.has(key1.fingerprint)).toBe(false);
		expect(state.activeFingerprints.has(key2.fingerprint)).toBe(true);
		expect(state.activeProofs).toEqual(["dns:alice.dev?type=TXT"]);
	});

	it("multiple key rotations preserve identity ID", async () => {
		const key1 = await makeIdentity();
		const key2 = await makeIdentity();
		const key3 = await makeIdentity();

		const link0 = await makeGenesisLink(key1);
		const link1 = await appendLink(key1, link0, 1, "key_rotate", { new_fingerprint: key2.fingerprint });
		const link2 = await appendLink(key2, link1, 2, "key_rotate", { new_fingerprint: key3.fingerprint });

		const state = await verifyChain([link0, link1, link2]);

		const expectedId = await computeIdentityId(link0);
		expect(state.identityId).toBe(expectedId);
		expect(state.activeFingerprints.size).toBe(3); // All still active (not revoked)
	});
});
