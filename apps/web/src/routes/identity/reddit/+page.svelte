<script lang="ts">
	import { onMount } from "svelte";
	import { getMe, type MeResponse } from "$lib/api";
	import {
		getStoredIdentity, fetchMyProfile, updateProfile, appendAfterAction, fetchChain,
		type MyProfile, type StoredIdentity
	} from "$lib/identity";
	import { parseProfile } from "@link42/identity";

	let me = $state<MeResponse | null>(null);
	let identity = $state<StoredIdentity | null>(null);
	let serverProfile = $state<MyProfile | null>(null);
	let existingClaims = $state<string[]>([]);
	let profileName = $state("");
	let profileDescription = $state<string | undefined>(undefined);
	let loading = $state(true);
	let postUrl = $state("");
	let adding = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		me = await getMe();
		if (!me) { loading = false; return; }
		identity = await getStoredIdentity();
		serverProfile = await fetchMyProfile();
		if (serverProfile) {
			try {
				const parsed = await parseProfile(serverProfile.profileJws);
				existingClaims = parsed.claims; profileName = parsed.name; profileDescription = parsed.description;
			} catch { /* ignore */ }
		}
		loading = false;
	});

	async function handleAddProof() {
		if (!identity || !postUrl.trim()) return;
		if (!postUrl.startsWith("https://www.reddit.com/") && !postUrl.startsWith("https://reddit.com/")) {
			error = "URL must be a Reddit post or comment"; return;
		}
		adding = true; error = null;
		try {
			await updateProfile(identity, profileName, [...existingClaims, postUrl.trim()], profileDescription);
			success = true;
			try {
				const chain = await fetchChain(identity.fingerprint);
				if (chain) await appendAfterAction(identity, chain.identityId, "proof_add", { claim_uri: postUrl.trim() });
			} catch (err) { console.error("Chain append failed:", err); }
		} catch (e) { error = e instanceof Error ? e.message : "Failed to add proof"; }
		adding = false;
	}

	async function copyProofText() {
		if (identity) await navigator.clipboard.writeText(`aspe:login2.link42.app:${identity.fingerprint}`);
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">&larr; Back to Identity</a>
	<h1>Add Reddit Proof</h1>
	<p>Link your Reddit account to your identity</p>
</div>

{#if loading}
	<p aria-busy="true">Loading...</p>
{:else if !me}
	<div class="empty-state"><p>Sign in first to manage your identity.</p></div>
{:else if !identity}
	<div class="empty-state"><p>Generate a key first on the Identity page.</p></div>
{:else if !serverProfile}
	<div class="empty-state"><p>Create a profile first on the Identity page.</p></div>
{:else if success}
	<div class="card">
		<div class="card-header">Done</div>
		<div class="card-body">
			<p style="color: var(--green); font-weight: 500; margin-bottom: 16px;">Reddit proof added successfully!</p>
			<a href="/identity" role="button" class="outline">&larr; Back to Identity</a>
		</div>
	</div>
{:else}
	{#if error}
		<div class="error-state" style="color: var(--red); margin-bottom: 16px;">{error}</div>
	{/if}

	<div class="grid">
		<div class="card">
			<div class="card-header">Step 1: Create a Reddit Post</div>
			<div class="card-body">
				<p>Create a post on your Reddit profile (or any subreddit) containing:</p>
				<div class="proof-box">
					<code>aspe:login2.link42.app:{identity.fingerprint}</code>
					<button class="btn-sm secondary" onclick={copyProofText}>Copy</button>
				</div>
				<a href="https://www.reddit.com/submit?type=TEXT" target="_blank" rel="noopener noreferrer" role="button" class="outline btn-sm" style="margin-top: 16px;">
					Create Reddit Post ↗
				</a>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Step 2: Paste Post URL</div>
			<div class="card-body">
				<form onsubmit={(e) => { e.preventDefault(); handleAddProof(); }}>
					<label>
						Reddit Post URL
						<input type="url" bind:value={postUrl} placeholder="https://www.reddit.com/r/..." required />
					</label>
					<button type="submit" aria-busy={adding} disabled={adding || !postUrl.trim()}>Add Proof</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.proof-box { display: flex; align-items: center; gap: 8px; margin: 12px 0; padding: 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; }
	.proof-box code { flex: 1; word-break: break-all; background: transparent; border: none; padding: 0; }
</style>
