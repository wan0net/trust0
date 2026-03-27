import { decode as base64urlDecode } from "jose/base64url";
import { describe, expect, it } from "vitest";
import { generateIdentityKey } from "../index.js";
import { jwkToSshPublicKey } from "../ssh.js";

describe("jwkToSshPublicKey", () => {
	it("produces valid SSH format", async () => {
		const { publicJWK } = await generateIdentityKey();
		const sshKey = jwkToSshPublicKey(publicJWK);

		expect(sshKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/]+=*$/);
	});

	it("includes comment when provided", async () => {
		const { publicJWK } = await generateIdentityKey();
		const sshKey = jwkToSshPublicKey(publicJWK, "test-comment");

		expect(sshKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/]+=* test-comment$/);
	});

	it("is deterministic", async () => {
		const { publicJWK } = await generateIdentityKey();
		const sshKey1 = jwkToSshPublicKey(publicJWK);
		const sshKey2 = jwkToSshPublicKey(publicJWK);

		expect(sshKey1).toBe(sshKey2);
	});

	it("rejects non-Ed25519 keys", () => {
		const badJWK: JsonWebKey = { kty: "RSA", n: "abc", e: "AQAB" };

		expect(() => jwkToSshPublicKey(badJWK)).toThrow("Invalid Ed25519 public JWK");
	});

	it("SSH key base64 decodes to valid wire format", async () => {
		const { publicJWK } = await generateIdentityKey();
		const sshKey = jwkToSshPublicKey(publicJWK);

		// Extract the base64 part (between "ssh-ed25519 " and end/comment)
		const b64Part = sshKey.split(" ")[1];
		const wireBytes = Uint8Array.from(atob(b64Part), (c) => c.charCodeAt(0));
		const view = new DataView(wireBytes.buffer);

		let offset = 0;

		// First 4 bytes: type string length (should be 11 for "ssh-ed25519")
		const typeLen = view.getUint32(offset);
		expect(typeLen).toBe(11);
		offset += 4;

		// Next 11 bytes: "ssh-ed25519"
		const typeStr = new TextDecoder().decode(wireBytes.slice(offset, offset + typeLen));
		expect(typeStr).toBe("ssh-ed25519");
		offset += typeLen;

		// Next 4 bytes: key data length (should be 32)
		const keyLen = view.getUint32(offset);
		expect(keyLen).toBe(32);
		offset += 4;

		// Next 32 bytes: raw public key — should match JWK x value
		const rawKeyFromWire = wireBytes.slice(offset, offset + keyLen);
		const rawKeyFromJWK = base64urlDecode(publicJWK.x!);
		expect(rawKeyFromWire).toEqual(rawKeyFromJWK);

		// Total wire length should be exactly 4 + 11 + 4 + 32 = 51
		expect(wireBytes.byteLength).toBe(51);
	});
});
