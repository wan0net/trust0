import { decode as base64urlDecode } from "jose/base64url";

/**
 * Convert an Ed25519 JWK public key to SSH public key format.
 * The JWK `x` field is the 32-byte raw public key, base64url-encoded.
 */
export function jwkToSshPublicKey(publicJWK: JsonWebKey, comment?: string): string {
	if (publicJWK.kty !== "OKP" || publicJWK.crv !== "Ed25519" || typeof publicJWK.x !== "string") {
		throw new Error("Invalid Ed25519 public JWK");
	}

	// Decode the raw 32-byte public key from base64url
	const rawKey = base64urlDecode(publicJWK.x);

	// Build SSH wire format: [type-length][type][key-length][key]
	const keyType = new TextEncoder().encode("ssh-ed25519");

	// 4 bytes for type length + type bytes + 4 bytes for key length + key bytes
	const wireLength = 4 + keyType.byteLength + 4 + rawKey.byteLength;
	const wire = new Uint8Array(wireLength);
	const view = new DataView(wire.buffer);

	let offset = 0;

	// Type string length (big-endian uint32)
	view.setUint32(offset, keyType.byteLength);
	offset += 4;

	// Type string
	wire.set(keyType, offset);
	offset += keyType.byteLength;

	// Key data length (big-endian uint32)
	view.setUint32(offset, rawKey.byteLength);
	offset += 4;

	// Key data
	wire.set(rawKey, offset);

	// Base64 encode the wire format (loop to avoid spread overflow)
	let binary = "";
	for (let i = 0; i < wire.length; i++) {
		binary += String.fromCharCode(wire[i]);
	}
	const b64 = btoa(binary);

	const suffix = comment ? ` ${comment}` : "";
	return `ssh-ed25519 ${b64}${suffix}`;
}

/**
 * Generate git config commands for commit signing with this key.
 */
export function gitSigningConfig(sshPublicKey: string): string {
	return [
		"# Save the public key to a file first:",
		"# echo '<public key>' > ~/.ssh/identity_ed25519.pub",
		"",
		"git config --global gpg.format ssh",
		`git config --global user.signingkey ~/.ssh/identity_ed25519.pub`,
		"git config --global commit.gpgsign true",
	].join("\n");
}
