import { describe, expect, it } from "vitest";
import {
	computeFingerprint,
	computeIdentityId,
	computeLinkHash,
	createChainLink,
	generateIdentityKey,
	parseChainLink,
	verifyChain,
} from "../index.js";

describe("chain", () => {
	it("createChainLink returns compact JWS", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const jws = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		expect(jws.split(".")).toHaveLength(3);
	});

	it("parseChainLink round-trips a genesis link", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const jws = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const parsed = await parseChainLink(jws);

		expect(parsed.version).toBe(1);
		expect(parsed.seqno).toBe(0);
		expect(parsed.prev).toBeNull();
		expect(parsed.type).toBe("key_init");
		expect(parsed.body).toEqual({ key: publicJWK });
		expect(parsed.fingerprint).toBe(fingerprint);
		expect(parsed.publicJWK.x).toBe(publicJWK.x);
		expect(typeof parsed.timestamp).toBe("number");
	});

	it("parseChainLink round-trips a non-genesis link", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const genesis = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const prevHash = await computeLinkHash(genesis);

		const link1 = await createChainLink({
			seqno: 1,
			prev: prevHash,
			type: "proof_add",
			body: { claim_uri: "https://example.com/.well-known/keybase.txt" },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const parsed = await parseChainLink(link1);

		expect(parsed.version).toBe(1);
		expect(parsed.seqno).toBe(1);
		expect(parsed.prev).toBe(prevHash);
		expect(parsed.type).toBe("proof_add");
		expect(parsed.body.claim_uri).toBe("https://example.com/.well-known/keybase.txt");
	});

	it("parseChainLink rejects tampered JWS", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const jws = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const [headerPart, payloadPart, signaturePart] = jws.split(".");
		const lastChar = payloadPart[payloadPart.length - 1];
		const replacementChar = lastChar === "A" ? "B" : "A";
		const tamperedPayload = `${payloadPart.slice(0, -1)}${replacementChar}`;
		const tampered = `${headerPart}.${tamperedPayload}.${signaturePart}`;

		await expect(parseChainLink(tampered)).rejects.toThrow();
	});

	it("parseChainLink rejects seqno=0 with non-null prev", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		await expect(
			createChainLink({
				seqno: 0,
				prev: "sha256:fakehash",
				type: "key_init",
				body: { key: publicJWK },
				key: privateKey,
				publicJWK,
				fingerprint,
			}),
		).rejects.toThrow("Genesis link (seqno=0) must have null prev");
	});

	it("parseChainLink rejects seqno>0 with null prev", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		await expect(
			createChainLink({
				seqno: 1,
				prev: null,
				type: "proof_add",
				body: { claim_uri: "https://example.com" },
				key: privateKey,
				publicJWK,
				fingerprint,
			}),
		).rejects.toThrow("Non-genesis link (seqno>0) must have a prev hash");
	});

	it("computeLinkHash returns consistent sha256: prefixed hash", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const jws = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash1 = await computeLinkHash(jws);
		const hash2 = await computeLinkHash(jws);

		expect(hash1).toBe(hash2);
		expect(hash1).toMatch(/^sha256:/);
	});

	it("computeIdentityId returns 52-char BASE32", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const jws = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const id = await computeIdentityId(jws);

		expect(id).toMatch(/^[A-Z2-7]{52}$/);
	});

	it("verifyChain verifies a valid 3-link chain", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash0 = await computeLinkHash(link0);

		const link1 = await createChainLink({
			seqno: 1,
			prev: hash0,
			type: "proof_add",
			body: { claim_uri: "https://example.com/.well-known/keybase.txt" },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash1 = await computeLinkHash(link1);

		const link2 = await createChainLink({
			seqno: 2,
			prev: hash1,
			type: "username_claim",
			body: { username: "alice" },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const state = await verifyChain([link0, link1, link2]);

		expect(state.identityId).toMatch(/^[A-Z2-7]{52}$/);
		expect(state.activeFingerprints.has(fingerprint)).toBe(true);
		expect(state.activeProofs).toEqual(["https://example.com/.well-known/keybase.txt"]);
		expect(state.username).toBe("alice");
		expect(state.links).toHaveLength(3);
	});

	it("verifyChain rejects broken prev hash", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		// Use a bogus prev hash instead of the real one
		const link1 = await createChainLink({
			seqno: 1,
			prev: "sha256:bogushashvalue",
			type: "proof_add",
			body: { claim_uri: "https://example.com" },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		await expect(verifyChain([link0, link1])).rejects.toThrow("invalid prev hash");
	});

	it("verifyChain rejects non-incrementing seqno", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash0 = await computeLinkHash(link0);

		// Skip seqno 1, go straight to 2
		const link1 = await createChainLink({
			seqno: 2,
			prev: hash0,
			type: "proof_add",
			body: { claim_uri: "https://example.com" },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		await expect(verifyChain([link0, link1])).rejects.toThrow("invalid seqno");
	});

	it("verifyChain rejects chain where link 0 is not key_init", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "proof_add",
			body: { claim_uri: "https://example.com" },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		await expect(verifyChain([link0])).rejects.toThrow("must be key_init");
	});

	it("verifyChain matches expected identity ID", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const expectedId = await computeIdentityId(link0);
		const state = await verifyChain([link0], expectedId);

		expect(state.identityId).toBe(expectedId);
	});

	it("verifyChain handles proof_revoke correctly", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash0 = await computeLinkHash(link0);

		const claimUri = "https://example.com/.well-known/keybase.txt";

		const link1 = await createChainLink({
			seqno: 1,
			prev: hash0,
			type: "proof_add",
			body: { claim_uri: claimUri },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash1 = await computeLinkHash(link1);

		const link2 = await createChainLink({
			seqno: 2,
			prev: hash1,
			type: "proof_revoke",
			body: { claim_uri: claimUri },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const state = await verifyChain([link0, link1, link2]);

		expect(state.activeProofs).toEqual([]);
		expect(state.links).toHaveLength(3);
		expect(state.links[2].type).toBe("proof_revoke");
	});

	it("verifyChain tracks profile_update", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const hash0 = await computeLinkHash(link0);

		const link1 = await createChainLink({
			seqno: 1,
			prev: hash0,
			type: "profile_update",
			body: { profile_fingerprint: fingerprint },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		const state = await verifyChain([link0, link1]);

		expect(state.currentProfileFingerprint).toBe(fingerprint);
		expect(state.links).toHaveLength(2);
		expect(state.links[1].type).toBe("profile_update");
	});

	it("verifyChain rejects wrong expected identity ID", async () => {
		const { privateKey, publicJWK } = await generateIdentityKey();
		const fingerprint = await computeFingerprint(publicJWK);

		const link0 = await createChainLink({
			seqno: 0,
			prev: null,
			type: "key_init",
			body: { key: publicJWK },
			key: privateKey,
			publicJWK,
			fingerprint,
		});

		await expect(
			verifyChain([link0], "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
		).rejects.toThrow("Identity ID mismatch");
	});
});
