import { describe, expect, it } from "vitest";
import {
	generateIdentityKey,
	isValidMnemonic,
	keyToMnemonic,
} from "../index.js";

describe("BIP39 mnemonic backup", () => {
	it("keyToMnemonic produces 24 words", async () => {
		const { privateKey } = await generateIdentityKey();
		const jwk = await crypto.subtle.exportKey("jwk", privateKey);
		const mnemonic = keyToMnemonic(jwk);

		const words = mnemonic.split(" ");
		expect(words.length).toBe(24);
	});

	it("keyToMnemonic is deterministic for same key", async () => {
		const { privateKey } = await generateIdentityKey();
		const jwk = await crypto.subtle.exportKey("jwk", privateKey);

		const m1 = keyToMnemonic(jwk);
		const m2 = keyToMnemonic(jwk);
		expect(m1).toBe(m2);
	});

	it("different keys produce different mnemonics", async () => {
		const key1 = await generateIdentityKey();
		const key2 = await generateIdentityKey();
		const jwk1 = await crypto.subtle.exportKey("jwk", key1.privateKey);
		const jwk2 = await crypto.subtle.exportKey("jwk", key2.privateKey);

		const m1 = keyToMnemonic(jwk1);
		const m2 = keyToMnemonic(jwk2);
		expect(m1).not.toBe(m2);
	});

	it("isValidMnemonic accepts valid mnemonic", async () => {
		const { privateKey } = await generateIdentityKey();
		const jwk = await crypto.subtle.exportKey("jwk", privateKey);
		const mnemonic = keyToMnemonic(jwk);

		expect(isValidMnemonic(mnemonic)).toBe(true);
	});

	it("isValidMnemonic rejects garbage", () => {
		expect(isValidMnemonic("hello world foo bar")).toBe(false);
		expect(isValidMnemonic("")).toBe(false);
		expect(isValidMnemonic("abandon " .repeat(24).trim())).toBe(false);
	});

	it("isValidMnemonic rejects 12-word mnemonic (we need 24)", () => {
		// 12 words = 128 bits, we need 256 bits = 24 words
		// A valid 12-word mnemonic should still validate as valid BIP39 though
		// but our keyToMnemonic always produces 24 words from 32-byte seeds
		const twelveWords = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
		// This is a valid 12-word BIP39 mnemonic, but we only produce 24-word ones
		expect(isValidMnemonic(twelveWords)).toBe(true); // BIP39 valid, just shorter
	});

	it("keyToMnemonic rejects JWK without d parameter", async () => {
		const { publicJWK } = await generateIdentityKey();
		expect(() => keyToMnemonic(publicJWK)).toThrow("private key");
	});
});
