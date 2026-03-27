import { describe, expect, it } from "vitest";
import { encode as base64urlEncode } from "jose/base64url";
import {
	computeFingerprint,
	generateIdentityKey,
	signDocument,
	verifyDocumentSignature,
} from "../index.js";
import type { SignatureBundle } from "../index.js";

const TEST_DOC = new TextEncoder().encode("Hello, world! This is a test document.");
const TEST_DOC_NAME = "hello.txt";

async function createTestBundle(overrides?: {
	aspeUri?: string;
	identityId?: string;
}): Promise<{ bundle: SignatureBundle; document: Uint8Array }> {
	const { privateKey, publicJWK } = await generateIdentityKey();
	const fingerprint = await computeFingerprint(publicJWK);

	const bundle = await signDocument({
		document: TEST_DOC,
		documentName: TEST_DOC_NAME,
		key: privateKey,
		publicJWK,
		fingerprint,
		...overrides,
	});

	return { bundle, document: TEST_DOC };
}

describe("signing", () => {
	it("signDocument produces valid SignatureBundle", async () => {
		const { bundle } = await createTestBundle();

		expect(bundle.version).toBe(1);
		expect(bundle.format).toBe("jws-detached");
		expect(typeof bundle.jws.protected).toBe("string");
		expect(bundle.jws.protected.length).toBeGreaterThan(0);
		expect(typeof bundle.jws.signature).toBe("string");
		expect(bundle.jws.signature.length).toBeGreaterThan(0);
		expect(bundle.document.name).toBe(TEST_DOC_NAME);
		expect(bundle.document.size).toBe(TEST_DOC.byteLength);
		expect(typeof bundle.signedAt).toBe("number");
	});

	it("verifyDocumentSignature round-trips successfully", async () => {
		const { bundle, document } = await createTestBundle();

		const result = await verifyDocumentSignature({ document, bundle });

		expect(result.valid).toBe(true);
		expect(result.fingerprint).toBe(bundle.signer.fingerprint);
		expect(result.documentName).toBe(TEST_DOC_NAME);
		expect(result.documentHash).toBe(bundle.document.hash);
		expect(result.signedAt).toBe(bundle.signedAt);
		expect(result.publicJWK).toEqual(bundle.signer.jwk);
	});

	it("verifyDocumentSignature rejects tampered document", async () => {
		const { bundle, document } = await createTestBundle();

		// Flip one byte in the document
		const tampered = new Uint8Array(document);
		tampered[0] = tampered[0] ^ 0xff;

		await expect(
			verifyDocumentSignature({ document: tampered, bundle }),
		).rejects.toThrow();
	});

	it("verifyDocumentSignature rejects tampered signature", async () => {
		const { bundle, document } = await createTestBundle();

		// Replace significant portion of the signature to guarantee corruption
		const sig = bundle.jws.signature;
		const mid = Math.floor(sig.length / 2);
		const tamperedSig = sig.slice(0, mid - 4) + "AAAAAAAA" + sig.slice(mid + 4);

		const tamperedBundle: SignatureBundle = {
			...bundle,
			jws: {
				...bundle.jws,
				signature: tamperedSig,
			},
		};

		await expect(
			verifyDocumentSignature({ document, bundle: tamperedBundle }),
		).rejects.toThrow();
	});

	it("SignatureBundle contains correct document metadata", async () => {
		const { bundle } = await createTestBundle();

		expect(bundle.document.name).toBe(TEST_DOC_NAME);
		expect(bundle.document.size).toBe(TEST_DOC.byteLength);
		expect(bundle.document.hash).toMatch(/^sha256:/);
		expect(bundle.document.hash.length).toBeGreaterThan("sha256:".length);
	});

	it("signDocument includes identity metadata when provided", async () => {
		const aspeUri = "aspe:keyoxide.org:abc123";
		const identityId = "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH";

		const { bundle } = await createTestBundle({ aspeUri, identityId });

		expect(bundle.signer.aspeUri).toBe(aspeUri);
		expect(bundle.signer.identityId).toBe(identityId);

		// Also verify it round-trips through verification
		const result = await verifyDocumentSignature({ document: TEST_DOC, bundle });
		expect(result.aspeUri).toBe(aspeUri);
		expect(result.identityId).toBe(identityId);
	});

	it("document hash matches independent SHA-256", async () => {
		const { bundle } = await createTestBundle();

		// Compute SHA-256 independently
		const hashBuffer = await crypto.subtle.digest("SHA-256", TEST_DOC);
		const expectedHash = `sha256:${base64urlEncode(new Uint8Array(hashBuffer))}`;

		expect(bundle.document.hash).toBe(expectedHash);
	});
});
