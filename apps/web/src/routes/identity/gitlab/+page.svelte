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
	let snippetUrl = $state("");
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
		if (!identity || !snippetUrl.trim()) return;
		const url = snippetUrl.trim();
		if (!url.startsWith("https://gitlab.com/") || !url.includes("/snippets/")) {
			error = "URL must be a GitLab snippet (https://gitlab.com/...snippets/...)";
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
	<h1>Add GitLab Proof</h1>
	<p>Link your GitLab account to your identity</p>
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
				GitLab proof added successfully!
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
			<div class="card-header">Step 1: Create a GitLab Snippet</div>
			<div class="card-body">
				<p>Create a <strong>public</strong> snippet on GitLab containing this text:</p>
				<div class="proof-box">
					<code>aspe:login2.link42.app:{identity.fingerprint}</code>
					<button class="btn-sm secondary" onclick={copyProofText}>Copy</button>
				</div>
				<a href="https://gitlab.com/-/snippets/new" target="_blank" rel="noopener noreferrer" role="button" class="outline btn-sm" style="margin-top: 16px;">
					Create GitLab Snippet ↗
				</a>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Step 2: Paste Snippet URL</div>
			<div class="card-body">
				<form onsubmit={(e) => { e.preventDefault(); handleAddProof(); }}>
					<label>
						Snippet URL
						<input
							type="url"
							bind:value={snippetUrl}
							placeholder="https://gitlab.com/-/snippets/12345"
							required
						/>
					</label>
					<p style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 12px;">
						Must be a GitLab snippet URL containing <code>/snippets/</code>
					</p>
					<button type="submit" aria-busy={adding} disabled={adding || !snippetUrl.trim()}>
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
