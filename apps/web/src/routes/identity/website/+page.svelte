<script lang="ts">
	import { onMount } from "svelte";
	import { getMe, type MeResponse } from "$lib/api";
	import {
		getStoredIdentity,
		fetchMyProfile,
		updateProfile,
		appendAfterAction,
		fetchChain,
		type MyProfile,
		type StoredIdentity
	} from "$lib/identity";
	import { parseProfile } from "@link42/identity";

	let me = $state<MeResponse | null>(null);
	let identity = $state<StoredIdentity | null>(null);
	let serverProfile = $state<MyProfile | null>(null);
	let existingClaims = $state<string[]>([]);
	let profileName = $state("");
	let profileDescription = $state<string | undefined>(undefined);
	let loading = $state(true);
	let websiteUrl = $state("");
	let adding = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		me = await getMe();
		if (!me) {
			loading = false;
			return;
		}
		identity = await getStoredIdentity();
		serverProfile = await fetchMyProfile();
		if (serverProfile) {
			try {
				const parsed = await parseProfile(serverProfile.profileJws);
				existingClaims = parsed.claims;
				profileName = parsed.name;
				profileDescription = parsed.description;
			} catch {
				/* ignore */
			}
		}
		loading = false;
	});

	async function handleAddProof() {
		if (!identity || !websiteUrl.trim()) return;
		const url = websiteUrl.trim();
		if (!url.startsWith("https://")) {
			error = "URL must start with https://";
			return;
		}
		adding = true;
		error = null;
		try {
			await updateProfile(
				identity,
				profileName,
				[...existingClaims, url],
				profileDescription
			);
			success = true;

			// Append proof_add to sigchain
			if (identity) {
				try {
					const chain = await fetchChain(identity.fingerprint);
					if (chain) {
						await appendAfterAction(identity, chain.identityId, "proof_add", { claim_uri: url });
					}
				} catch (err) {
					console.error("Chain append failed:", err);
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to add proof";
		}
		adding = false;
	}

	async function copyProofText() {
		if (identity) {
			await navigator.clipboard.writeText(`aspe:login2.link42.app:${identity.fingerprint}`);
		}
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">&larr; Back to Identity</a>
	<h1>Add Website Proof</h1>
	<p>Link your personal website to your identity</p>
</div>

{#if loading}
	<p aria-busy="true">Loading...</p>
{:else if !me}
	<div class="empty-state">
		<p>Sign in first to manage your identity.</p>
	</div>
{:else if !identity}
	<div class="empty-state">
		<p>Generate a key first on the Identity page.</p>
	</div>
{:else if !serverProfile}
	<div class="empty-state">
		<p>Create a profile first on the Identity page.</p>
	</div>
{:else if success}
	<div class="card">
		<div class="card-header">Done</div>
		<div class="card-body">
			<p style="color: var(--green); font-weight: 500; margin-bottom: 16px;">
				Website proof added successfully!
			</p>
			<a href="/identity" role="button" class="outline">&larr; Back to Identity</a>
		</div>
	</div>
{:else}
	{#if error}
		<div class="error-state" style="color: var(--red); margin-bottom: 16px;">
			{error}
		</div>
	{/if}

	<div class="grid">
		<div class="card">
			<div class="card-header">Step 1: Add Proof to Your Website</div>
			<div class="card-body">
				<p>Choose one of two methods to prove ownership of your website:</p>

				<h4 style="margin-top: 16px; margin-bottom: 8px;">Option A: Well-Known File</h4>
				<p>Create a file at <code>/.well-known/openpgp/proof</code> on your website containing:</p>
				<div class="proof-box">
					<code>aspe:login2.link42.app:{identity.fingerprint}</code>
					<button class="btn-sm secondary" onclick={copyProofText}>Copy</button>
				</div>

				<h4 style="margin-top: 20px; margin-bottom: 8px;">Option B: Meta Tag</h4>
				<p>Add this meta tag to the <code>&lt;head&gt;</code> of your homepage:</p>
				<div class="proof-box">
					<code>&lt;meta name="ariadne-id" content="aspe:login2.link42.app:{identity.fingerprint}"&gt;</code>
					<button class="btn-sm secondary" onclick={async () => {
						if (identity) {
							await navigator.clipboard.writeText(`<meta name="ariadne-id" content="aspe:login2.link42.app:${identity.fingerprint}">`);
						}
					}}>Copy</button>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Step 2: Enter Your Website URL</div>
			<div class="card-body">
				<form onsubmit={(e) => { e.preventDefault(); handleAddProof(); }}>
					<label>
						Website URL
						<input
							type="url"
							bind:value={websiteUrl}
							placeholder="https://alice.dev"
							required
						/>
					</label>
					<p style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 12px;">
						Must start with <code>https://</code>
					</p>
					<button type="submit" aria-busy={adding} disabled={adding || !websiteUrl.trim()}>
						Add Proof
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.proof-box {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 0;
		padding: 12px;
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.proof-box code {
		flex: 1;
		word-break: break-all;
		background: transparent;
		border: none;
		padding: 0;
	}
</style>
