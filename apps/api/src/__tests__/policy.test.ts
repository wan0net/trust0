import { computeLinkHash, createChainLink, generateIdentityKey, verifyChain } from "@trust0/identity";
import { describe, expect, it } from "vitest";
import {
	assertAppendAuthorized,
	assertProfileMatchesChainState,
	classifyProfileUpdate,
} from "../policy";

async function makeIdentity() {
	const { privateKey, publicJWK } = await generateIdentityKey();
	const { computeFingerprint } = await import("@trust0/identity");
	const fingerprint = await computeFingerprint(publicJWK);
	return { privateKey, publicJWK, fingerprint };
}

async function buildRotatedState() {
	const key1 = await makeIdentity();
	const key2 = await makeIdentity();

	const genesis = await createChainLink({
		seqno: 0,
		prev: null,
		type: "key_init",
		body: { fingerprint: key1.fingerprint },
		key: key1.privateKey,
		publicJWK: key1.publicJWK,
		fingerprint: key1.fingerprint,
	});

	const rotate = await createChainLink({
		seqno: 1,
		prev: await computeLinkHash(genesis),
		type: "key_rotate",
		body: { new_fingerprint: key2.fingerprint },
		key: key1.privateKey,
		publicJWK: key1.publicJWK,
		fingerprint: key1.fingerprint,
	});

	const update = await createChainLink({
		seqno: 2,
		prev: await computeLinkHash(rotate),
		type: "profile_update",
		body: { profile_fingerprint: key2.fingerprint },
		key: key2.privateKey,
		publicJWK: key2.publicJWK,
		fingerprint: key2.fingerprint,
	});

	const state = await verifyChain([genesis, rotate, update]);
	return { key1, key2, state };
}

async function buildRevokedState() {
	const key1 = await makeIdentity();
	const key2 = await makeIdentity();

	const genesis = await createChainLink({
		seqno: 0,
		prev: null,
		type: "key_init",
		body: { fingerprint: key1.fingerprint },
		key: key1.privateKey,
		publicJWK: key1.publicJWK,
		fingerprint: key1.fingerprint,
	});

	const rotate = await createChainLink({
		seqno: 1,
		prev: await computeLinkHash(genesis),
		type: "key_rotate",
		body: { new_fingerprint: key2.fingerprint },
		key: key1.privateKey,
		publicJWK: key1.publicJWK,
		fingerprint: key1.fingerprint,
	});

	const update = await createChainLink({
		seqno: 2,
		prev: await computeLinkHash(rotate),
		type: "profile_update",
		body: { profile_fingerprint: key2.fingerprint },
		key: key2.privateKey,
		publicJWK: key2.publicJWK,
		fingerprint: key2.fingerprint,
	});

	const revoke = await createChainLink({
		seqno: 3,
		prev: await computeLinkHash(update),
		type: "key_revoke",
		body: { fingerprint: key1.fingerprint },
		key: key2.privateKey,
		publicJWK: key2.publicJWK,
		fingerprint: key2.fingerprint,
	});

	const state = await verifyChain([genesis, rotate, update, revoke]);
	return { key1, key2, state };
}

describe("api policy", () => {
	it("allows appends from a rotated active key", async () => {
		const { key2, state } = await buildRotatedState();
		expect(() => assertAppendAuthorized(state, key2.fingerprint)).not.toThrow();
	});

	it("rejects appends from an inactive key", async () => {
		const { key1, state } = await buildRevokedState();
		expect(() => assertAppendAuthorized(state, key1.fingerprint)).toThrow(
			"Signer is not an active key for this identity",
		);
	});

	it("classifies a rotated-key profile update as valid", async () => {
		const { key1, key2, state } = await buildRotatedState();
		expect(classifyProfileUpdate(state, key1.fingerprint, key2.fingerprint)).toBe(
			"rotated-key",
		);
	});

	it("rejects a rotated-key profile update from an inactive signer", async () => {
		const { key1, state } = await buildRotatedState();
		const outsider = await makeIdentity();
		expect(() =>
			classifyProfileUpdate(state, key1.fingerprint, outsider.fingerprint),
		).toThrow("Signer is not an active key for this identity");
	});

	it("rejects imported/current profiles that do not match chain state", async () => {
		const { key1, state } = await buildRotatedState();
		expect(() => assertProfileMatchesChainState(state, key1.fingerprint)).toThrow(
			"Profile fingerprint does not match the sigchain's current profile",
		);
	});
});
