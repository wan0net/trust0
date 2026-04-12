import {
	type ChainLinkType,
	computeFingerprint,
	computeLinkHash,
	createChainLink,
	createProfile,
	createRequest,
	generateIdentityKey,
} from "@trust0/identity";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";
const ASPE_DOMAIN = import.meta.env.VITE_ASPE_DOMAIN || "trust0.app";

// ── Key Storage (IndexedDB — CryptoKey objects stored as opaque handles) ────

export interface StoredIdentity {
	privateKey: CryptoKey;
	publicKey: CryptoKey;
	publicJWK: JsonWebKey;
	fingerprint: string;
}

const DB_NAME = "trust0_identity";
const STORE_NAME = "keys";
const KEY_ID = "primary";

function openIdentityDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(STORE_NAME);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function getStoredIdentity(): Promise<StoredIdentity | null> {
	try {
		const db = await openIdentityDB();
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const store = tx.objectStore(STORE_NAME);
			const request = store.get(KEY_ID);
			request.onsuccess = () => {
				const record = request.result;
				if (!record) return resolve(null);
				resolve({
					privateKey: record.privateKey,
					publicKey: record.publicKey,
					publicJWK: record.publicJWK,
					fingerprint: record.fingerprint,
				});
			};
			request.onerror = () => reject(request.error);
		});
	} catch {
		return null;
	}
}

export async function generateAndStoreIdentity(): Promise<StoredIdentity> {
	const { privateKey, publicKey, publicJWK } = await generateIdentityKey();
	const fingerprint = await computeFingerprint(publicJWK);

	const db = await openIdentityDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		store.put({ privateKey, publicKey, publicJWK, fingerprint }, KEY_ID);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});

	return { privateKey, publicKey, publicJWK, fingerprint };
}

export async function clearStoredIdentity(): Promise<void> {
	const db = await openIdentityDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		store.delete(KEY_ID);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function hasStoredIdentity(): Promise<boolean> {
	try {
		const identity = await getStoredIdentity();
		return identity !== null;
	} catch {
		return false;
	}
}

// ── API Helpers ────────────────────────────────────────────────────────────

export interface MyProfile {
	fingerprint: string;
	profileJws: string;
	username: string | null;
	createdAt: string;
	updatedAt: string;
}

function getAspeUri(fingerprint: string): string {
	return `aspe:${ASPE_DOMAIN}:${fingerprint}`;
}

export async function fetchMyProfile(): Promise<MyProfile | null> {
	try {
		const res = await fetch(`${API_BASE}/api/identity/my-profile`, {
			credentials: "include",
		});
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return (await res.json()) as MyProfile;
	} catch {
		return null;
	}
}

export async function uploadProfile(
	identity: StoredIdentity,
	name: string,
	claims: string[],
	description?: string,
	avatarUrl?: string,
	color?: string,
): Promise<{ fingerprint: string; uri: string }> {
	const profileJws = await createProfile({
		name,
		claims,
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
		description,
		avatarUrl,
		color,
	});

	const requestJws = await createRequest({
		action: "create",
		profileJws,
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
	});

	const res = await fetch(`${API_BASE}/.well-known/aspe/post/`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "text/plain" },
		body: requestJws,
	});

	if (!res.ok) {
		const err = (await res
			.json()
			.catch(() => ({ error: "Upload failed" }))) as { error: string };
		throw new Error(err.error);
	}

	return (await res.json()) as { fingerprint: string; uri: string };
}

export async function updateProfile(
	identity: StoredIdentity,
	name: string,
	claims: string[],
	description?: string,
	avatarUrl?: string,
	color?: string,
	targetFingerprint?: string,
): Promise<void> {
	const profileJws = await createProfile({
		name,
		claims,
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
		description,
		avatarUrl,
		color,
	});

	const requestJws = await createRequest({
		action: "update",
		profileJws,
		aspeUri: getAspeUri(targetFingerprint ?? identity.fingerprint),
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
	});

	const res = await fetch(`${API_BASE}/.well-known/aspe/post/`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "text/plain" },
		body: requestJws,
	});

	if (!res.ok) {
		const err = (await res
			.json()
			.catch(() => ({ error: "Update failed" }))) as { error: string };
		throw new Error(err.error);
	}
}

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export async function exportEncryptedBackup(
	passphrase: string,
): Promise<string> {
	const identity = await getStoredIdentity();
	if (!identity) throw new Error("No identity key to export");

	const fullJwk = await crypto.subtle.exportKey("jwk", identity.privateKey);
	const data = JSON.stringify(fullJwk);

	const encoder = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	const aesKey = await crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt"],
	);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		aesKey,
		encoder.encode(data),
	);

	const backup = {
		v: 1,
		salt: uint8ToBase64(salt),
		iv: uint8ToBase64(iv),
		data: uint8ToBase64(new Uint8Array(ciphertext)),
	};

	return btoa(JSON.stringify(backup));
}

export async function importEncryptedBackup(
	backupString: string,
	passphrase: string,
): Promise<StoredIdentity> {
	const encoder = new TextEncoder();

	let backup: { v: number; salt: string; iv: string; data: string };
	try {
		backup = JSON.parse(atob(backupString));
	} catch {
		throw new Error("Invalid backup format");
	}

	if (backup.v !== 1) throw new Error("Unsupported backup version");

	const salt = Uint8Array.from(atob(backup.salt), (c) => c.charCodeAt(0));
	const iv = Uint8Array.from(atob(backup.iv), (c) => c.charCodeAt(0));
	const ciphertext = Uint8Array.from(atob(backup.data), (c) => c.charCodeAt(0));

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(passphrase),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	const aesKey = await crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["decrypt"],
	);

	let decrypted: ArrayBuffer;
	try {
		decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv },
			aesKey,
			ciphertext,
		);
	} catch {
		throw new Error("Wrong passphrase or corrupted backup");
	}

	const jwkJson = new TextDecoder().decode(decrypted);
	const jwk = JSON.parse(jwkJson) as JsonWebKey;

	if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
		throw new Error("Invalid key type in backup");
	}

	const privateKey = await crypto.subtle.importKey("jwk", jwk, "Ed25519", true, ["sign"]);
	const publicJWK = { kty: jwk.kty!, crv: jwk.crv!, x: jwk.x! };
	const publicKey = await crypto.subtle.importKey("jwk", publicJWK as JsonWebKey, "Ed25519", true, ["verify"]);
	const fingerprint = await computeFingerprint(publicJWK as JsonWebKey);

	const db = await openIdentityDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		store.put({ privateKey, publicKey, publicJWK: publicJWK as JsonWebKey, fingerprint }, KEY_ID);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});

	return { privateKey, publicKey, publicJWK: publicJWK as JsonWebKey, fingerprint };
}

export async function claimUsername(
	username: string,
	fingerprint: string,
): Promise<void> {
	const res = await fetch(`${API_BASE}/api/identity/username/claim`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, fingerprint }),
	});

	if (!res.ok) {
		const err = (await res.json().catch(() => ({ error: "Claim failed" }))) as {
			error: string;
		};
		throw new Error(err.error);
	}
}

// ── Email Challenge-Response Verification ──────────────────────────────────

export async function requestEmailChallenge(): Promise<{
	email: string;
	expiresAt: string;
}> {
	const res = await fetch(`${API_BASE}/api/identity/email/challenge`, {
		method: "POST",
		credentials: "include",
	});

	if (!res.ok) {
		const err = (await res.json().catch(() => ({ error: "Challenge request failed" }))) as { error: string };
		throw new Error(err.error);
	}

	return (await res.json()) as { email: string; expiresAt: string };
}

export async function verifyEmailChallenge(
	identity: StoredIdentity,
	challenge: string,
): Promise<{ email: string; fingerprint: string }> {
	const { CompactSign } = await import("jose");

	// Sign the challenge with the identity key
	const signedChallenge = await new CompactSign(new TextEncoder().encode(challenge))
		.setProtectedHeader({
			alg: "EdDSA",
			kid: identity.fingerprint,
			jwk: {
				kty: identity.publicJWK.kty!,
				crv: identity.publicJWK.crv!,
				x: identity.publicJWK.x!,
			},
		})
		.sign(identity.privateKey);

	const res = await fetch(`${API_BASE}/api/identity/email/verify`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ signedChallenge }),
	});

	if (!res.ok) {
		const err = (await res.json().catch(() => ({ error: "Verification failed" }))) as { error: string };
		throw new Error(err.error);
	}

	return (await res.json()) as { email: string; fingerprint: string };
}

// ── Sigchain Helpers ─────────────────────────────────────────────────────

export async function initializeChain(
	identity: StoredIdentity,
): Promise<{ identityId: string }> {
	const genesisLinkJws = await createChainLink({
		seqno: 0,
		prev: null,
		type: "key_init",
		body: { fingerprint: identity.fingerprint },
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
	});

	const res = await fetch(`${API_BASE}/api/identity/chain/init`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ genesisLinkJws }),
	});

	if (!res.ok) {
		const err = (await res
			.json()
			.catch(() => ({ error: "Chain init failed" }))) as { error: string };
		throw new Error(err.error);
	}

	return (await res.json()) as { identityId: string };
}

export interface ChainLink {
	seqno: number;
	type: string;
	linkJws: string;
	prevHash: string | null;
	createdAt: string;
}

export interface ChainResponse {
	identityId: string;
	fingerprint: string;
	links: ChainLink[];
}

export async function fetchChain(
	identityIdOrFingerprint: string,
): Promise<ChainResponse | null> {
	try {
		const res = await fetch(
			`${API_BASE}/api/identity/chain/${identityIdOrFingerprint}`,
			{
				credentials: "include",
			},
		);
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return (await res.json()) as ChainResponse;
	} catch {
		return null;
	}
}

export async function appendAfterAction(
	identity: StoredIdentity,
	identityId: string,
	type: ChainLinkType,
	body: Record<string, unknown>,
): Promise<void> {
	// Fetch current chain to get last link's hash and seqno
	const chain = await fetchChain(identityId);
	if (!chain || chain.links.length === 0) {
		throw new Error("Chain not found or empty");
	}

	const lastLink = chain.links[chain.links.length - 1];
	const prevHash = await computeLinkHash(lastLink.linkJws);

	const linkJws = await createChainLink({
		seqno: lastLink.seqno + 1,
		prev: prevHash,
		type,
		body,
		key: identity.privateKey,
		publicJWK: identity.publicJWK,
		fingerprint: identity.fingerprint,
	});

	const res = await fetch(`${API_BASE}/api/identity/chain/append`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ linkJws }),
	});

	if (!res.ok) {
		const err = (await res
			.json()
			.catch(() => ({ error: "Chain append failed" }))) as { error: string };
		throw new Error(err.error);
	}
}

// ── Key Rotation ──────────────────────────────────────────────────────────

export async function rotateKey(
	oldIdentity: StoredIdentity,
	identityId: string,
	name: string,
	claims: string[],
	description?: string,
): Promise<StoredIdentity> {
	// 1. Generate new keypair
	const newIdentity = await generateAndStoreIdentity();

	// 2. Append key_rotate link signed by OLD key
	await appendAfterAction(oldIdentity, identityId, "key_rotate", {
		new_fingerprint: newIdentity.fingerprint,
		new_jwk: {
			kty: newIdentity.publicJWK.kty,
			crv: newIdentity.publicJWK.crv,
			x: newIdentity.publicJWK.x,
		},
	});

	// 3. Create new profile with new key
	await updateProfile(
		newIdentity,
		name,
		claims,
		description,
		undefined,
		undefined,
		oldIdentity.fingerprint,
	);

	// 4. Append profile_update link signed by NEW key (now authorized via rotation)
	await appendAfterAction(newIdentity, identityId, "profile_update", {
		profile_fingerprint: newIdentity.fingerprint,
	});

	return newIdentity;
}

export async function fetchIdentityById(identityId: string): Promise<{
	identityId: string;
	fingerprint: string;
	profileJws: string;
	username: string | null;
	createdAt: string;
} | null> {
	try {
		const res = await fetch(`${API_BASE}/api/identity/id/${identityId}`, {
			credentials: "include",
		});
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} catch {
		return null;
	}
}
