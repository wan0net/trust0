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

	const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

	let me = $state<MeResponse | null>(null);
	let identity = $state<StoredIdentity | null>(null);
	let serverProfile = $state<MyProfile | null>(null);
	let existingClaims = $state<string[]>([]);
	let profileName = $state("");
	let profileDescription = $state<string | undefined>(undefined);
	let loading = $state(true);
	let checking = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);

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

	async function copyCommand() {
		if (identity) {
			await navigator.clipboard.writeText(`/verify ${identity.fingerprint}`);
		}
	}

	async function checkStatus() {
		if (!identity) return;
		checking = true;
		error = null;
		statusMessage = null;
		try {
			const res = await fetch(`${API_BASE}/api/identity/attestation-status/${identity.fingerprint}/discord`);
			if (!res.ok) {
				statusMessage = "Not yet verified. Send the DM to the bot and try again.";
				checking = false;
				return;
			}
			const data = await res.json() as { attested: boolean; platformUserId?: string; platformUsername?: string };
			if (data.attested && data.platformUserId) {
				// Add claim URI to profile
				const claimUri = `discord:${data.platformUserId}`;
				if (!existingClaims.includes(claimUri)) {
					const updatedClaims = [...existingClaims, claimUri];
					await updateProfile(identity, profileName, updatedClaims, profileDescription);
					existingClaims = updatedClaims;
				}

				// Append proof_add to sigchain
				try {
					const chain = await fetchChain(identity.fingerprint);
					if (chain) {
						await appendAfterAction(identity, chain.identityId, "proof_add", { claim_uri: `discord:${data.platformUserId}` });
					}
				} catch (err) {
					console.error("Chain append failed:", err);
				}

				success = true;
			} else {
				statusMessage = "Not yet verified. Send the DM to the bot and try again.";
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to check verification status";
		}
		checking = false;
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">← Back to Identity</a>
	<h1>Add Discord Proof</h1>
	<p>Link your Discord account to your identity</p>
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
				Discord proof added successfully!
			</p>
			<a href="/identity" role="button" class="outline">← Back to Identity</a>
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
			<div class="card-header">Step 1: DM the Bot</div>
			<div class="card-body">
				<p>Send the following command as a DM to the Link42 Discord bot:</p>
				<div class="proof-box">
					<code>/verify {identity.fingerprint}</code>
					<button class="btn-sm secondary" onclick={copyCommand}>Copy</button>
				</div>
				<p style="color: var(--text-dim); font-size: 13px; margin-top: 12px;">
					The bot will verify your Discord account and attest the link to your identity.
				</p>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Step 2: Check Verification Status</div>
			<div class="card-body">
				<p>After sending the command to the bot, click below to check if verification is complete.</p>
				{#if statusMessage}
					<p style="color: var(--amber); font-size: 14px; margin: 12px 0;">
						{statusMessage}
					</p>
				{/if}
				<button onclick={checkStatus} aria-busy={checking} disabled={checking}>
					Check Verification Status
				</button>
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
