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
	let npub = $state("");
	let adding = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);
	let nostrConnected = $state(false);
	let nostrSignature = $state("");

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

	async function connectNostr() {
		const nostr = (window as any).nostr;
		if (!nostr) {
			error = "No Nostr extension detected. Install nos2x, Alby, or another NIP-07 extension.";
			return;
		}
		error = null;
		try {
			const pubkey = await nostr.getPublicKey();
			// Convert hex pubkey to npub (simplified — just store hex for now)
			npub = pubkey;
			nostrConnected = true;
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to connect Nostr extension";
		}
	}

	async function handleSignAndAdd() {
		if (!identity || !npub) return;
		adding = true; error = null;
		try {
			const nostr = (window as any).nostr;

			// Create a Nostr event (kind 1 = text note) containing the cross-signature
			const content = `Verifying my identity: aspe:login2.link42.app:${identity.fingerprint}`;
			const event = {
				kind: 1,
				content,
				tags: [["i", `aspe:login2.link42.app:${identity.fingerprint}`, "identity"]],
				created_at: Math.floor(Date.now() / 1000),
			};

			// Sign with Nostr key via NIP-07 extension
			const signedEvent = await nostr.signEvent(event);
			nostrSignature = JSON.stringify(signedEvent);

			const claimUri = `nostr:${npub}`;
			await updateProfile(identity, profileName, [...existingClaims, claimUri], profileDescription);
			success = true;

			try {
				const chain = await fetchChain(identity.fingerprint);
				if (chain) await appendAfterAction(identity, chain.identityId, "proof_add", {
					claim_uri: claimUri,
					nostr_event: signedEvent,
				});
			} catch (err) { console.error("Chain append failed:", err); }
		} catch (e) {
			error = e instanceof Error ? e.message : "Nostr signing failed";
		}
		adding = false;
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">&larr; Back to Identity</a>
	<h1>Add Nostr Proof</h1>
	<p>Cross-sign your identity with your Nostr key</p>
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
			<p style="color: var(--green); font-weight: 500; margin-bottom: 16px;">Nostr identity linked!</p>
			<p style="font-family: monospace; font-size: 12px; color: var(--text-dim); word-break: break-all; margin-bottom: 16px;">{npub}</p>
			<p style="font-size: 13px; color: var(--text-dim); margin-bottom: 16px;">
				Both keys now vouch for each other — your identity key signed a claim to the Nostr key,
				and your Nostr key signed a claim to your identity.
			</p>
			<a href="/identity" role="button" class="outline">&larr; Back to Identity</a>
		</div>
	</div>
{:else}
	{#if error}
		<div class="error-state" style="color: var(--red); margin-bottom: 16px;">{error}</div>
	{/if}

	<div class="grid">
		<div class="card">
			<div class="card-header">Step 1: Connect Nostr Extension</div>
			<div class="card-body">
				<p style="color: var(--text-dim); font-size: 14px; margin-bottom: 12px;">
					Connect your Nostr browser extension (nos2x, Alby, etc.) to read your public key.
				</p>
				{#if !nostrConnected}
					<button onclick={connectNostr}>Connect Nostr</button>
				{:else}
					<div class="proof-box"><code>{npub}</code></div>
					<p style="color: var(--green); font-size: 13px; margin-top: 8px;">Connected</p>
				{/if}
			</div>
		</div>

		{#if nostrConnected}
			<div class="card">
				<div class="card-header">Step 2: Cross-Sign</div>
				<div class="card-body">
					<p style="color: var(--text-dim); font-size: 14px; margin-bottom: 12px;">
						Your Nostr extension will sign a message containing your identity fingerprint.
						This creates a mutual proof — both keys vouch for each other.
					</p>
					<button onclick={handleSignAndAdd} aria-busy={adding} disabled={adding}>
						Sign & Link
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.proof-box { display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; }
	.proof-box code { flex: 1; word-break: break-all; background: transparent; border: none; padding: 0; font-size: 12px; }
</style>
