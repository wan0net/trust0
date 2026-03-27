import { base32 } from "rfc4648";

type IdentityKeyPair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJWK: JsonWebKey;
};

export async function generateIdentityKey(): Promise<IdentityKeyPair> {
  const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);

  if (!("privateKey" in keyPair) || !("publicKey" in keyPair)) {
    throw new Error("Failed to generate Ed25519 key pair");
  }

  const publicJWK = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJWK,
  };
}

export async function computeFingerprint(jwk: JsonWebKey): Promise<string> {
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
    throw new Error("Invalid Ed25519 public JWK");
  }

  const canonicalJwk = {
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
  };

  const canonicalJson = JSON.stringify(canonicalJwk);
  const encoded = new TextEncoder().encode(canonicalJson);
  const digest = await crypto.subtle.digest("SHA-512", encoded);
  const first16Bytes = new Uint8Array(digest).slice(0, 16);

  return base32.stringify(first16Bytes, { pad: false }).toUpperCase();
}
