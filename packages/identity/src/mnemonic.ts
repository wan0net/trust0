import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

/**
 * Convert an Ed25519 private key (JWK) to a 24-word BIP39 mnemonic.
 * The 32-byte Ed25519 seed (JWK "d" parameter) maps to exactly 24 words.
 */
export function keyToMnemonic(privateJwk: JsonWebKey): string {
	if (!privateJwk.d) {
		throw new Error("JWK must contain a private key (d parameter)");
	}

	// Decode the base64url-encoded 32-byte seed
	const seed = Uint8Array.from(
		atob(privateJwk.d.replace(/-/g, "+").replace(/_/g, "/")),
		(c) => c.charCodeAt(0),
	);

	if (seed.length !== 32) {
		throw new Error(`Expected 32-byte seed, got ${seed.length} bytes`);
	}

	// 32 bytes = 256 bits = 24-word BIP39 mnemonic
	return entropyToMnemonic(seed, wordlist);
}

/**
 * Recover an Ed25519 private key (as JWK) from a 24-word BIP39 mnemonic.
 * Returns the full JWK including both private (d) and public (x) components.
 */
export async function mnemonicToKey(mnemonic: string): Promise<{
	privateJwk: JsonWebKey;
	publicJwk: JsonWebKey;
	fingerprint: string;
}> {
	if (!validateMnemonic(mnemonic, wordlist)) {
		throw new Error("Invalid mnemonic phrase");
	}

	const seed = mnemonicToEntropy(mnemonic, wordlist);

	// Import the seed as an Ed25519 private key
	// The seed IS the private key for Ed25519 (the 32-byte scalar)
	// We need to construct the JWK with the d parameter
	const seedB64 = btoa(String.fromCharCode(...seed))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

	// Import via WebCrypto to derive the public key
	const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
	// We can't import a raw seed directly as Ed25519 in all browsers,
	// so we construct the JWK by importing the seed as the "d" parameter
	const templateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

	// Replace the random key material with our mnemonic-derived seed
	templateJwk.d = seedB64;

	// Re-import to get the correct public key derivation
	const privateKey = await crypto.subtle.importKey("jwk", templateJwk, "Ed25519", true, ["sign"]);
	const privateJwk = await crypto.subtle.exportKey("jwk", privateKey);
	const publicJwk = { kty: privateJwk.kty!, crv: privateJwk.crv!, x: privateJwk.x! };

	const { computeFingerprint } = await import("./keys.js");
	const fingerprint = await computeFingerprint(publicJwk as JsonWebKey);

	return { privateJwk, publicJwk: publicJwk as JsonWebKey, fingerprint };
}

/**
 * Validate a mnemonic phrase without attempting to import it.
 */
export function isValidMnemonic(mnemonic: string): boolean {
	return validateMnemonic(mnemonic, wordlist);
}
