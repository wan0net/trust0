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
	import { parseProfile } from "@trust0/identity";

	let me = $state<MeResponse | null>(null);
	let identity = $state<StoredIdentity | null>(null);
	let serverProfile = $state<MyProfile | null>(null);
	let existingClaims = $state<string[]>([]);
	let profileName = $state("");
	let profileDescription = $state<string | undefined>(undefined);
	let loading = $state(true);
	let username = $state("");
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
		if (!identity || !username.trim()) return;
		const name = username.trim();
		if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
			error = "Username must be alphanumeric (letters, numbers, hyphens, underscores)";
			return;
		}
		const claimUri = `https://news.ycombinator.com/user?id=${name}`;
		adding = true;
		error = null;
		try {
			await updateProfile(
				identity,
				profileName,
				[...existingClaims, claimUri],
				profileDescription
			);
			success = true;

			// Append proof_add to sigchain
			if (identity) {
				try {
					const chain = await fetchChain(identity.fingerprint);
					if (chain) {
						await appendAfterAction(identity, chain.identityId, "proof_add", { claim_uri: claimUri });
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
			await navigator.clipboard.writeText(`aspe:trust0.app:${identity.fingerprint}`);
		}
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">&larr; Back to Identity</a>
	<h1>Add Hacker News Proof</h1>
	<p>Link your Hacker News account to your identity</p>
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
				Hacker News proof added successfully!
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
			<div class="card-header">Step 1: Add Proof to Your HN Bio</div>
			<div class="card-body">
				<p>Paste this text into your Hacker News "about" field:</p>
				<div class="proof-box">
					<code>aspe:trust0.app:{identity.fingerprint}</code>
					<button class="btn-sm secondary" onclick={copyProofText}>Copy</button>
				</div>
				{#if username.trim()}
					<a href={`https://news.ycombinator.com/user?id=${username.trim()}`} target="_blank" rel="noopener noreferrer" role="button" class="outline btn-sm" style="margin-top: 16px;">
						Open Your HN Profile ↗
					</a>
				{:else}
					<a href="https://news.ycombinator.com/user" target="_blank" rel="noopener noreferrer" role="button" class="outline btn-sm" style="margin-top: 16px;">
						Open HN Profile Settings ↗
					</a>
				{/if}
				<p style="margin-top: 12px; font-size: 0.9em; color: var(--text-muted);">
					Go to your HN profile page and edit the "about" field at the top to include the proof text.
				</p>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Step 2: Enter Your Username</div>
			<div class="card-body">
				<form onsubmit={(e) => { e.preventDefault(); handleAddProof(); }}>
					<label>
						Hacker News Username
						<input
							type="text"
							bind:value={username}
							placeholder="alice"
							required
						/>
					</label>
					<p style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 12px;">
						Your claim will link to <code>https://news.ycombinator.com/user?id={username.trim() || "..."}</code>
					</p>
					<button type="submit" aria-busy={adding} disabled={adding || !username.trim()}>
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
