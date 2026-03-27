import {
	FlattenedSign,
	flattenedVerify,
	importJWK,
	type JWK,
} from "jose";
import { encode as base64urlEncode } from "jose/base64url";
import { computeFingerprint } from "./keys.js";

// ── Types ──────────────────────────────────────────────────────────

export type RekorTimestamp = {
	logIndex: number;
	logId: string;
	integratedTime: number;
	body: string;
};

export type SignatureBundle = {
	version: 1;
	format: "jws-detached";
	jws: {
		protected: string;
		signature: string;
	};
	signer: {
		fingerprint: string;
		jwk: { kty: string; crv: string; x: string };
		aspeUri?: string;
		identityId?: string;
	};
	document: {
		name: string;
		hash: string;
		size: number;
	};
	signedAt: number;
	timestamp?: {
		rekor?: RekorTimestamp;
	};
};

export type MultiSignatureBundle = {
	version: 1;
	format: "multi-sig";
	document: {
		name: string;
		hash: string;
		size: number;
	};
	signatures: Array<{
		signer: SignatureBundle["signer"];
		jws: SignatureBundle["jws"];
		signedAt: number;
		timestamp?: SignatureBundle["timestamp"];
	}>;
};

export type SignDocumentParams = {
	document: Uint8Array;
	documentName: string;
	key: CryptoKey;
	publicJWK: JsonWebKey;
	fingerprint: string;
	aspeUri?: string;
	identityId?: string;
};

export type VerifiedSignature = {
	valid: true;
	fingerprint: string;
	publicJWK: JsonWebKey;
	documentName: string;
	documentHash: string;
	signedAt: number;
	identityId?: string;
	aspeUri?: string;
};

// ── Helpers ────────────────────────────────────────────────────────

function getHeaderJwk(publicJWK: JsonWebKey): { kty: "OKP"; crv: "Ed25519"; x: string } {
	if (publicJWK.kty !== "OKP" || publicJWK.crv !== "Ed25519" || typeof publicJWK.x !== "string") {
		throw new Error("Invalid Ed25519 public JWK");
	}
	return { kty: "OKP", crv: "Ed25519", x: publicJWK.x };
}

async function computeDocHash(document: Uint8Array): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(document) as unknown as ArrayBuffer);
	return `sha256:${base64urlEncode(new Uint8Array(hash))}`;
}

// ── Functions ──────────────────────────────────────────────────────

export async function signDocument(params: SignDocumentParams): Promise<SignatureBundle> {
	const { document, documentName, key, publicJWK, fingerprint, aspeUri, identityId } = params;

	const docHash = await computeDocHash(document);
	const iat = Math.floor(Date.now() / 1000);
	const jwk = getHeaderJwk(publicJWK);

	const header: Record<string, unknown> = {
		alg: "EdDSA",
		b64: false,
		crit: ["b64"],
		kid: fingerprint,
		jwk,
		"x-doc-hash": docHash,
		"x-doc-name": documentName,
		iat,
	};

	if (aspeUri) header["x-identity"] = aspeUri;
	if (identityId) header["x-identity-id"] = identityId;

	const jws = await new FlattenedSign(document)
		.setProtectedHeader(header as any)
		.sign(key);

	return {
		version: 1,
		format: "jws-detached",
		jws: {
			protected: jws.protected!,
			signature: jws.signature,
		},
		signer: {
			fingerprint,
			jwk,
			...(aspeUri && { aspeUri }),
			...(identityId && { identityId }),
		},
		document: {
			name: documentName,
			hash: docHash,
			size: document.byteLength,
		},
		signedAt: iat,
	};
}

export async function verifyDocumentSignature(params: {
	document: Uint8Array;
	bundle: SignatureBundle;
}): Promise<VerifiedSignature> {
	const { document, bundle } = params;

	// Import public key from bundle
	const publicJWK: JsonWebKey = bundle.signer.jwk;
	const key = await importJWK(publicJWK as JWK, "EdDSA");

	// Re-attach document bytes as payload for verification
	const result = await flattenedVerify(
		{
			protected: bundle.jws.protected,
			payload: document,
			signature: bundle.jws.signature,
		},
		key,
	);

	const protectedHeader = result.protectedHeader;
	if (!protectedHeader) {
		throw new Error("Missing protected header in verification result");
	}

	// Verify document hash
	const expectedHash = await computeDocHash(document);
	const headerHash = protectedHeader["x-doc-hash"] as string;
	if (headerHash !== expectedHash) {
		throw new Error("Document hash mismatch — document has been tampered with");
	}

	// Verify fingerprint
	const fp = await computeFingerprint(publicJWK);
	if (fp !== protectedHeader.kid) {
		throw new Error("Signer fingerprint mismatch");
	}

	const verified: VerifiedSignature = {
		valid: true,
		fingerprint: fp,
		publicJWK,
		documentName: (protectedHeader["x-doc-name"] as string) || bundle.document.name,
		documentHash: headerHash,
		signedAt: (protectedHeader.iat as number) || bundle.signedAt,
	};

	const identityId = protectedHeader["x-identity-id"];
	if (identityId) verified.identityId = identityId as string;

	const aspeUri = protectedHeader["x-identity"];
	if (aspeUri) verified.aspeUri = aspeUri as string;

	return verified;
}

// ── Multi-Party Signatures ─────────────────────────────────────────

export function mergeSignatures(bundles: SignatureBundle[]): MultiSignatureBundle {
	if (bundles.length === 0) throw new Error("At least one signature bundle required");

	const docHash = bundles[0].document.hash;
	for (const b of bundles) {
		if (b.document.hash !== docHash) {
			throw new Error("All bundles must sign the same document (hash mismatch)");
		}
	}

	return {
		version: 1,
		format: "multi-sig",
		document: { ...bundles[0].document },
		signatures: bundles.map((b) => ({
			signer: b.signer,
			jws: b.jws,
			signedAt: b.signedAt,
			...(b.timestamp && { timestamp: b.timestamp }),
		})),
	};
}

export async function verifyMultiSignature(params: {
	document: Uint8Array;
	bundle: MultiSignatureBundle;
}): Promise<VerifiedSignature[]> {
	const { document, bundle } = params;
	const results: VerifiedSignature[] = [];

	for (const sig of bundle.signatures) {
		const singleBundle: SignatureBundle = {
			version: 1,
			format: "jws-detached",
			jws: sig.jws,
			signer: sig.signer,
			document: bundle.document,
			signedAt: sig.signedAt,
			...(sig.timestamp && { timestamp: sig.timestamp }),
		};
		results.push(await verifyDocumentSignature({ document, bundle: singleBundle }));
	}

	return results;
}

// ── Rekor Timestamping ─────────────────────────────────────────────

const REKOR_URL = "https://rekor.sigstore.dev/api/v1/log/entries";

export async function submitToRekor(
	bundle: SignatureBundle,
	publicKeyPem: string,
): Promise<RekorTimestamp> {
	// Reconstruct the signed content: protected.signature (no payload for detached)
	const signedContent = `${bundle.jws.protected}..${bundle.jws.signature}`;
	const contentBytes = new TextEncoder().encode(signedContent);
	const hashBuffer = await crypto.subtle.digest("SHA-256", contentBytes);
	const hashHex = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");

	const entry = {
		apiVersion: "0.0.1",
		kind: "hashedrekord",
		spec: {
			data: {
				hash: {
					algorithm: "sha256",
					value: hashHex,
				},
			},
			signature: {
				content: btoa(signedContent),
				publicKey: {
					content: btoa(publicKeyPem),
				},
			},
		},
	};

	const res = await fetch(REKOR_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(entry),
	});

	if (!res.ok) {
		const err = await res.text().catch(() => "Unknown error");
		throw new Error(`Rekor submission failed (${res.status}): ${err}`);
	}

	const result = await res.json() as Record<string, { logIndex: number; body: string; integratedTime: number; logID: string }>;
	const uuid = Object.keys(result)[0];
	const logEntry = result[uuid];

	return {
		logIndex: logEntry.logIndex,
		logId: logEntry.logID,
		integratedTime: logEntry.integratedTime,
		body: logEntry.body,
	};
}

export function jwkToPublicKeyPem(jwk: { kty: string; crv: string; x: string }): string {
	// Ed25519 public key in SubjectPublicKeyInfo DER format
	// OID 1.3.101.112 = Ed25519
	const rawKey = Uint8Array.from(atob(jwk.x.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

	// SubjectPublicKeyInfo wrapper for Ed25519
	const spki = new Uint8Array([
		0x30, 0x2a, // SEQUENCE (42 bytes)
		0x30, 0x05, // SEQUENCE (5 bytes) — AlgorithmIdentifier
		0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
		0x03, 0x21, 0x00, // BIT STRING (33 bytes, 0 unused bits)
		...rawKey,
	]);

	let binary = "";
	for (let i = 0; i < spki.length; i++) {
		binary += String.fromCharCode(spki[i]);
	}
	const b64 = btoa(binary);

	const lines = b64.match(/.{1,64}/g) || [];
	return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}
