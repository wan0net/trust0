import {
	CompactSign,
	compactVerify,
	decodeProtectedHeader,
	importJWK,
	type JWK,
} from "jose";
import { encode as base64urlEncode } from "jose/base64url";
import { base32 } from "rfc4648";
import { computeFingerprint } from "./keys.js";

// ── Types ──────────────────────────────────────────────────────────

export type ChainLinkType =
	| "key_init"
	| "key_rotate"
	| "key_revoke"
	| "proof_add"
	| "proof_revoke"
	| "profile_update"
	| "username_claim"
	| "username_release"
	| "doc_sign";

const VALID_LINK_TYPES: ReadonlySet<string> = new Set<ChainLinkType>([
	"key_init",
	"key_rotate",
	"key_revoke",
	"proof_add",
	"proof_revoke",
	"profile_update",
	"username_claim",
	"username_release",
	"doc_sign",
]);

export type ChainLinkParams = {
	seqno: number;
	prev: string | null;
	type: ChainLinkType;
	body: Record<string, unknown>;
	key: CryptoKey;
	publicJWK: JsonWebKey;
	fingerprint: string;
};

export type ParsedChainLink = {
	version: number;
	seqno: number;
	prev: string | null;
	timestamp: number;
	type: ChainLinkType;
	body: Record<string, unknown>;
	fingerprint: string;
	publicJWK: JsonWebKey;
};

export type ChainState = {
	identityId: string;
	activeFingerprints: Set<string>;
	activeProofs: string[];
	currentProfileFingerprint: string | null;
	username: string | null;
	links: ParsedChainLink[];
};

// ── Helpers ────────────────────────────────────────────────────────

function getHeaderJwk(publicJWK: JsonWebKey): { kty: "OKP"; crv: "Ed25519"; x: string } {
	if (publicJWK.kty !== "OKP" || publicJWK.crv !== "Ed25519" || typeof publicJWK.x !== "string") {
		throw new Error("Invalid Ed25519 public JWK");
	}

	return {
		kty: "OKP",
		crv: "Ed25519",
		x: publicJWK.x,
	};
}

// ── Core Functions ─────────────────────────────────────────────────

export async function createChainLink(params: ChainLinkParams): Promise<string> {
	const { seqno, prev, type, body, key, publicJWK, fingerprint } = params;

	if (seqno === 0 && prev !== null) {
		throw new Error("Genesis link (seqno=0) must have null prev");
	}

	if (seqno > 0 && typeof prev !== "string") {
		throw new Error("Non-genesis link (seqno>0) must have a prev hash");
	}

	const payload = {
		version: 1,
		seqno,
		prev,
		timestamp: Math.floor(Date.now() / 1000),
		type,
		body,
	};

	return await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
		.setProtectedHeader({
			typ: "JWT",
			alg: "EdDSA",
			kid: fingerprint,
			jwk: getHeaderJwk(publicJWK),
		})
		.sign(key);
}

export async function parseChainLink(jws: string): Promise<ParsedChainLink> {
	const header = decodeProtectedHeader(jws);

	if (typeof header.kid !== "string") {
		throw new Error("Missing or invalid chain link key id");
	}

	if (!header.jwk || typeof header.jwk !== "object") {
		throw new Error("Missing chain link public JWK");
	}

	const publicJWK: JsonWebKey = header.jwk;
	const fingerprint = await computeFingerprint(publicJWK);

	if (fingerprint !== header.kid) {
		throw new Error("Chain link fingerprint mismatch");
	}

	const key = await importJWK(publicJWK as JWK, "EdDSA");
	const { payload } = await compactVerify(jws, key);
	const decoded = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;

	if (decoded.version !== 1) {
		throw new Error("Unsupported chain link version");
	}

	const seqno = decoded.seqno;
	if (typeof seqno !== "number" || !Number.isInteger(seqno) || seqno < 0) {
		throw new Error("Invalid chain link seqno");
	}

	const type = decoded.type;
	if (typeof type !== "string" || !VALID_LINK_TYPES.has(type)) {
		throw new Error("Invalid chain link type");
	}

	const prev = decoded.prev;
	if (prev !== null && typeof prev !== "string") {
		throw new Error("Invalid chain link prev");
	}

	if (seqno === 0 && prev !== null) {
		throw new Error("Genesis link (seqno=0) must have null prev");
	}

	if (seqno > 0 && typeof prev !== "string") {
		throw new Error("Non-genesis link (seqno>0) must have a prev hash");
	}

	const timestamp = decoded.timestamp;
	if (typeof timestamp !== "number") {
		throw new Error("Invalid chain link timestamp");
	}

	const body = decoded.body;
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new Error("Invalid chain link body");
	}

	return {
		version: 1,
		seqno,
		prev,
		timestamp,
		type: type as ChainLinkType,
		body: body as Record<string, unknown>,
		fingerprint,
		publicJWK,
	};
}

export async function computeLinkHash(jws: string): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jws));
	return `sha256:${base64urlEncode(new Uint8Array(hashBuffer))}`;
}

export async function computeIdentityId(genesisJws: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(genesisJws));
	return base32.stringify(new Uint8Array(hash), { pad: false }).toUpperCase();
}

export async function verifyChain(links: string[], expectedIdentityId?: string): Promise<ChainState> {
	if (links.length === 0) {
		throw new Error("Chain must contain at least one link");
	}

	// ── Parse and validate genesis link ────────────────────────────
	const genesis = await parseChainLink(links[0]);

	if (genesis.type !== "key_init") {
		throw new Error("First chain link must be key_init");
	}

	if (genesis.seqno !== 0) {
		throw new Error("Genesis link must have seqno 0");
	}

	if (genesis.prev !== null) {
		throw new Error("Genesis link must have null prev");
	}

	const identityId = await computeIdentityId(links[0]);

	if (expectedIdentityId !== undefined && identityId !== expectedIdentityId) {
		throw new Error("Identity ID mismatch");
	}

	// ── Initialize state ───────────────────────────────────────────
	const state: ChainState = {
		identityId,
		activeFingerprints: new Set([genesis.fingerprint]),
		activeProofs: [],
		currentProfileFingerprint: null,
		username: null,
		links: [genesis],
	};

	// ── Walk subsequent links ──────────────────────────────────────
	for (let i = 1; i < links.length; i++) {
		const link = await parseChainLink(links[i]);

		// Verify prev hash
		const expectedPrev = await computeLinkHash(links[i - 1]);
		if (link.prev !== expectedPrev) {
			throw new Error(`Link ${i} has invalid prev hash`);
		}

		// Verify seqno
		if (link.seqno !== i) {
			throw new Error(`Link ${i} has invalid seqno ${link.seqno}`);
		}

		// Verify signer is authorized
		if (!state.activeFingerprints.has(link.fingerprint)) {
			throw new Error(`Link ${i} signed by unauthorized key ${link.fingerprint}`);
		}

		// Update state based on link type
		switch (link.type) {
			case "proof_add":
				state.activeProofs.push(link.body.claim_uri as string);
				break;
			case "proof_revoke":
				state.activeProofs = state.activeProofs.filter(
					(uri) => uri !== link.body.claim_uri,
				);
				break;
			case "profile_update":
				state.currentProfileFingerprint = link.body.profile_fingerprint as string;
				break;
			case "username_claim":
				state.username = link.body.username as string;
				break;
			case "username_release":
				state.username = null;
				break;
			case "doc_sign":
				// Informational — no state change, just audit trail
				break;
			case "key_rotate": {
				const newFingerprint = link.body.new_fingerprint as string;
				if (!newFingerprint) {
					throw new Error(`Link ${i}: key_rotate missing new_fingerprint`);
				}
				state.activeFingerprints.add(newFingerprint);
				break;
			}
			case "key_revoke": {
				const revokedFingerprint = link.body.fingerprint as string;
				if (!revokedFingerprint) {
					throw new Error(`Link ${i}: key_revoke missing fingerprint`);
				}
				state.activeFingerprints.delete(revokedFingerprint);
				break;
			}
		}

		state.links.push(link);
	}

	return state;
}
