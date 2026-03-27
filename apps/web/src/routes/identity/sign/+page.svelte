<script lang="ts">
	import { onMount } from "svelte";
	import { getMe, type MeResponse } from "$lib/api";
	import {
		getStoredIdentity,
		fetchMyProfile,
		fetchChain,
		appendAfterAction,
		type MyProfile,
		type StoredIdentity,
	} from "$lib/identity";
	import {
		signDocument,
		verifyDocumentSignature,
		submitToRekor,
		jwkToPublicKeyPem,
		computeFingerprint,
		type SignatureBundle,
		type VerifiedSignature,
	} from "@link42/identity";
	import { encode as base64urlEncode } from "jose/base64url";

	let me = $state<MeResponse | null>(null);
	let identity = $state<StoredIdentity | null>(null);
	let loading = $state(true);
	let mode = $state<"sign" | "verify">("sign");

	// Sign state
	let signFile = $state<File | null>(null);
	let signFileHash = $state<string | null>(null);
	let signing = $state(false);
	let signResult = $state<SignatureBundle | null>(null);
	let signError = $state<string | null>(null);
	let timestamping = $state(false);
	let timestampError = $state<string | null>(null);

	// Verify state
	let verifyFile = $state<File | null>(null);
	let verifyBundleFile = $state<File | null>(null);
	let verifying = $state(false);
	let verifyResult = $state<VerifiedSignature | null>(null);
	let verifyError = $state<string | null>(null);

	onMount(async () => {
		me = await getMe();
		if (me) {
			identity = await getStoredIdentity();
		}
		loading = false;
	});

	async function computeHash(file: File): Promise<string> {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const hash = await crypto.subtle.digest("SHA-256", bytes);
		return `sha256:${base64urlEncode(new Uint8Array(hash))}`;
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		signFile = input.files?.[0] ?? null;
		signResult = null;
		signError = null;
		if (signFile) {
			signFileHash = await computeHash(signFile);
		}
	}

	async function handleSign() {
		if (!identity || !signFile) return;
		signing = true;
		signError = null;
		timestampError = null;
		try {
			const bytes = new Uint8Array(await signFile.arrayBuffer());
			const bundle = await signDocument({
				document: bytes,
				documentName: signFile.name,
				key: identity.privateKey,
				publicJWK: identity.publicJWK,
				fingerprint: identity.fingerprint,
				aspeUri: `aspe:login2.link42.app:${identity.fingerprint}`,
			});

			// Submit to Rekor transparency log for timestamping
			timestamping = true;
			try {
				const pem = jwkToPublicKeyPem({
					kty: identity.publicJWK.kty!,
					crv: identity.publicJWK.crv!,
					x: identity.publicJWK.x!,
				});
				const rekorTimestamp = await submitToRekor(bundle, pem);
				bundle.timestamp = { rekor: rekorTimestamp };
			} catch (e) {
				timestampError = e instanceof Error ? e.message : "Rekor timestamping failed";
			}
			timestamping = false;

			signResult = bundle;

			// Append doc_sign to sigchain (best-effort)
			try {
				const chain = await fetchChain(identity.fingerprint);
				if (chain) {
					await appendAfterAction(identity, chain.identityId, "doc_sign", {
						doc_hash: bundle.document.hash,
						doc_name: bundle.document.name,
						rekor_log_index: bundle.timestamp?.rekor?.logIndex,
					});
				}
			} catch { /* sigchain append is supplementary */ }
		} catch (e) {
			signError = e instanceof Error ? e.message : "Signing failed";
		}
		signing = false;
	}

	function downloadBundle() {
		if (!signResult || !signFile) return;
		const json = JSON.stringify(signResult, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${signFile.name}.sig.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleVerify() {
		if (!verifyFile || !verifyBundleFile) return;
		verifying = true;
		verifyError = null;
		verifyResult = null;
		try {
			const docBytes = new Uint8Array(await verifyFile.arrayBuffer());
			const bundleText = await verifyBundleFile.text();
			const bundle: SignatureBundle = JSON.parse(bundleText);
			verifyResult = await verifyDocumentSignature({ document: docBytes, bundle });
		} catch (e) {
			verifyError = e instanceof Error ? e.message : "Verification failed";
		}
		verifying = false;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(epoch: number): string {
		return new Date(epoch * 1000).toLocaleString();
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">← Back to Identity</a>
	<h1>Sign / Verify Document</h1>
	<p>Cryptographically sign documents or verify existing signatures.</p>
</div>

{#if loading}
	<p aria-busy="true">Loading...</p>
{:else if !me}
	<div class="empty-state">
		<p>Sign in first to manage your identity.</p>
	</div>
{:else}
	<div class="tabs">
		<button class="tab" class:active={mode === "sign"} onclick={() => mode = "sign"}>Sign</button>
		<button class="tab" class:active={mode === "verify"} onclick={() => mode = "verify"}>Verify</button>
	</div>

	{#if mode === "sign"}
		{#if !identity}
			<div class="empty-state">
				<p>Generate a key first on the <a href="/identity">Identity page</a>.</p>
			</div>
		{:else}
			{#if signError}
				<div class="error-state" style="color: var(--red); margin-bottom: 16px;">
					{signError}
				</div>
			{/if}

			<div class="grid">
				<div class="card">
					<div class="card-header">Select Document</div>
					<div class="card-body">
						<input type="file" onchange={handleFileSelect} />
						{#if signFile}
							<div class="proof-box" style="margin-top: 12px;">
								<div style="flex: 1;">
									<div><strong>{signFile.name}</strong></div>
									<div style="color: var(--text-dim); font-size: 13px;">{formatFileSize(signFile.size)}</div>
									{#if signFileHash}
										<div style="color: var(--text-dim); font-size: 12px; font-family: monospace; word-break: break-all; margin-top: 4px;">
											{signFileHash}
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="card">
					<div class="card-header">Sign</div>
					<div class="card-body">
						<p style="color: var(--text-dim); font-size: 14px; margin-bottom: 12px;">
							Create a detached Ed25519 signature for the selected document.
						</p>
						<button onclick={handleSign} aria-busy={signing} disabled={signing || !signFile}>
							Sign Document
						</button>
					</div>
				</div>

				{#if signResult}
					<div class="card">
						<div class="card-header">Signature Created</div>
						<div class="card-body">
							<p style="color: var(--green); font-weight: 500; margin-bottom: 12px;">
								Document signed successfully!
							</p>
							<div class="proof-box">
								<div style="flex: 1; font-size: 13px;">
									<div><strong>Document:</strong> {signResult.document.name}</div>
									<div><strong>Hash:</strong> <code style="font-size: 11px;">{signResult.document.hash}</code></div>
									<div><strong>Size:</strong> {formatFileSize(signResult.document.size)}</div>
									<div><strong>Signed:</strong> {formatDate(signResult.signedAt)}</div>
									<div><strong>Signer:</strong> <code style="font-size: 11px;">{signResult.signer.fingerprint}</code></div>
								{#if signResult.timestamp?.rekor}
									<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
										<div><strong>Rekor Log Index:</strong> {signResult.timestamp.rekor.logIndex}</div>
										<div><strong>Integrated:</strong> {formatDate(signResult.timestamp.rekor.integratedTime)}</div>
									</div>
								{/if}
								{#if timestampError}
									<div style="color: var(--amber); font-size: 12px; margin-top: 8px;">
										Rekor timestamping failed: {timestampError} (signature is still valid without timestamp)
									</div>
								{/if}
								</div>
							</div>
							<button class="outline" style="margin-top: 12px;" onclick={downloadBundle}>
								Download .sig.json
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

	{:else}
		{#if verifyError}
			<div class="error-state" style="color: var(--red); margin-bottom: 16px;">
				{verifyError}
			</div>
		{/if}

		<div class="grid">
			<div class="card">
				<div class="card-header">Select Files</div>
				<div class="card-body">
					<label>
						Original Document
						<input type="file" onchange={(e) => { const input = e.target as HTMLInputElement; verifyFile = input.files?.[0] ?? null; verifyResult = null; verifyError = null; }} />
					</label>
					<label style="margin-top: 12px;">
						Signature Bundle (.sig.json)
						<input type="file" accept=".json" onchange={(e) => { const input = e.target as HTMLInputElement; verifyBundleFile = input.files?.[0] ?? null; verifyResult = null; verifyError = null; }} />
					</label>
					<button onclick={handleVerify} aria-busy={verifying} disabled={verifying || !verifyFile || !verifyBundleFile} style="margin-top: 16px;">
						Verify Signature
					</button>
				</div>
			</div>

			{#if verifyResult}
				<div class="card">
					<div class="card-header">Result</div>
					<div class="card-body">
						<p style="color: var(--green); font-weight: 600; font-size: 1.1rem; margin-bottom: 12px;">
							Valid Signature
						</p>
						<div class="proof-box">
							<div style="flex: 1; font-size: 13px;">
								<div><strong>Document:</strong> {verifyResult.documentName}</div>
								<div><strong>Hash:</strong> <code style="font-size: 11px;">{verifyResult.documentHash}</code></div>
								<div><strong>Signed:</strong> {formatDate(verifyResult.signedAt)}</div>
								<div>
									<strong>Signer:</strong> <code style="font-size: 11px;">{verifyResult.fingerprint}</code>
								</div>
								{#if verifyResult.aspeUri}
									<div style="margin-top: 8px;">
										<a href="/identity/profile/{verifyResult.fingerprint}">View signer profile →</a>
									</div>
								{/if}
								{#if verifyResult.identityId}
									<div style="margin-top: 4px;">
										<strong>Identity ID:</strong> <code style="font-size: 11px;">{verifyResult.identityId}</code>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.tabs {
		display: flex;
		gap: 0;
		margin-bottom: 24px;
		border-bottom: 2px solid var(--border);
	}
	.tab {
		padding: 8px 24px;
		cursor: pointer;
		border: none;
		background: none;
		font-size: 1rem;
		color: var(--text-dim);
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
	}
	.tab.active {
		color: var(--accent, teal);
		border-bottom-color: var(--accent, teal);
		font-weight: 600;
	}

	.proof-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.proof-box code {
		background: transparent;
		border: none;
		padding: 0;
		word-break: break-all;
	}
</style>
