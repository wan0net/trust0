<script lang="ts">
	import { onMount } from "svelte";
	import { getMe, type MeResponse } from "$lib/api";
	import {
		getStoredIdentity, fetchMyProfile, updateProfile, appendAfterAction, fetchChain,
		type MyProfile, type StoredIdentity
	} from "$lib/identity";
	import { parseProfile } from "@trust0/identity";

	let me = $state<MeResponse | null>(null);
	let identity = $state<StoredIdentity | null>(null);
	let serverProfile = $state<MyProfile | null>(null);
	let existingClaims = $state<string[]>([]);
	let profileName = $state("");
	let profileDescription = $state<string | undefined>(undefined);
	let loading = $state(true);
	let solAddress = $state("");
	let signing = $state(false);
	let adding = $state(false);
	let success = $state(false);
	let error = $state<string | null>(null);
	let walletConnected = $state(false);

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

	async function connectWallet() {
		const solana = (window as any).solana;
		if (!solana?.isPhantom) {
			error = "No Solana wallet detected. Install Phantom or another Solana wallet.";
			return;
		}
		error = null;
		try {
			const resp = await solana.connect();
			solAddress = resp.publicKey.toString();
			walletConnected = true;
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to connect wallet";
		}
	}

	async function handleSignAndAdd() {
		if (!identity || !solAddress) return;
		signing = true; error = null;
		try {
			const message = `I am verifying my identity.\n\naspe:trust0.app:${identity.fingerprint}\nsolana:${solAddress}`;
			const encodedMessage = new TextEncoder().encode(message);

			const solana = (window as any).solana;
			const { signature } = await solana.signMessage(encodedMessage, "utf8");

			// Convert signature bytes to base64
			let sigB64 = "";
			for (let i = 0; i < signature.length; i++) {
				sigB64 += String.fromCharCode(signature[i]);
			}
			sigB64 = btoa(sigB64);

			const claimUri = `solana:${solAddress}`;
			adding = true;
			await updateProfile(identity, profileName, [...existingClaims, claimUri], profileDescription);
			success = true;

			try {
				const chain = await fetchChain(identity.fingerprint);
				if (chain) await appendAfterAction(identity, chain.identityId, "proof_add", {
					claim_uri: claimUri,
					sol_signature: sigB64,
					sol_message: message,
				});
			} catch (err) { console.error("Chain append failed:", err); }
		} catch (e) {
			error = e instanceof Error ? e.message : "Wallet signing failed";
		}
		signing = false; adding = false;
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">&larr; Back to Identity</a>
	<h1>Add Solana Proof</h1>
	<p>Prove ownership of a Solana address by signing a message with your wallet</p>
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
			<p style="color: var(--green); font-weight: 500; margin-bottom: 16px;">Solana address linked!</p>
			<div style="font-family: monospace; font-size: 13px; color: var(--text-dim); margin-bottom: 16px; word-break: break-all;">{solAddress}</div>
			<a href="/identity" role="button" class="outline">&larr; Back to Identity</a>
		</div>
	</div>
{:else}
	{#if error}
		<div class="error-state" style="color: var(--red); margin-bottom: 16px;">{error}</div>
	{/if}

	<div class="grid">
		<div class="card">
			<div class="card-header">Step 1: Connect Wallet</div>
			<div class="card-body">
				<p style="color: var(--text-dim); font-size: 14px; margin-bottom: 12px;">
					Connect your Solana wallet (Phantom, Solflare, etc.)
				</p>
				{#if !walletConnected}
					<button onclick={connectWallet}>Connect Wallet</button>
				{:else}
					<div class="proof-box"><code>{solAddress}</code></div>
					<p style="color: var(--green); font-size: 13px; margin-top: 8px;">Wallet connected</p>
				{/if}
			</div>
		</div>

		{#if walletConnected}
			<div class="card">
				<div class="card-header">Step 2: Sign & Link</div>
				<div class="card-body">
					<p style="color: var(--text-dim); font-size: 14px; margin-bottom: 12px;">
						Sign a message to cryptographically link your Solana address. No transaction — free signature.
					</p>
					<button onclick={handleSignAndAdd} aria-busy={signing || adding} disabled={signing || adding}>
						Sign & Link Address
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.proof-box { display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 8px; }
	.proof-box code { flex: 1; word-break: break-all; background: transparent; border: none; padding: 0; font-size: 13px; }
</style>
