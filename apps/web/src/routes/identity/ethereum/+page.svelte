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
	let ethAddress = $state("");
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
		if (typeof window === "undefined" || !(window as any).ethereum) {
			error = "No Ethereum wallet detected. Install MetaMask or another wallet extension.";
			return;
		}
		error = null;
		try {
			const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
			if (accounts && accounts.length > 0) {
				ethAddress = accounts[0];
				walletConnected = true;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to connect wallet";
		}
	}

	async function handleSignAndAdd() {
		if (!identity || !ethAddress) return;
		signing = true;
		error = null;

		try {
			// Message the user signs with their ETH wallet
			const message = `I am verifying my identity.\n\naspe:login2.link42.app:${identity.fingerprint}\nethereum:${ethAddress}`;

			// Request signature from wallet (personal_sign)
			const signature = await (window as any).ethereum.request({
				method: "personal_sign",
				params: [message, ethAddress],
			});

			// Store the claim as ethereum:{address} and the signature in the profile
			// The signature can be verified by anyone using ecrecover
			const claimUri = `ethereum:${ethAddress}`;

			adding = true;
			await updateProfile(
				identity,
				profileName,
				[...existingClaims, claimUri],
				profileDescription,
			);
			success = true;

			// Append proof_add to sigchain with the signature for auditability
			try {
				const chain = await fetchChain(identity.fingerprint);
				if (chain) {
					await appendAfterAction(identity, chain.identityId, "proof_add", {
						claim_uri: claimUri,
						eth_signature: signature,
						eth_message: message,
					});
				}
			} catch (err) { console.error("Chain append failed:", err); }
		} catch (e) {
			error = e instanceof Error ? e.message : "Wallet signing failed";
		}
		signing = false;
		adding = false;
	}
</script>

<div class="page-header">
	<a href="/identity" style="display: inline-block; margin-bottom: 16px;">&larr; Back to Identity</a>
	<h1>Add Ethereum Proof</h1>
	<p>Prove ownership of an Ethereum address by signing a message with your wallet</p>
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
			<p style="color: var(--green); font-weight: 500; margin-bottom: 16px;">
				Ethereum address linked successfully!
			</p>
			<div style="font-family: monospace; font-size: 13px; color: var(--text-dim); margin-bottom: 16px; word-break: break-all;">
				{ethAddress}
			</div>
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
					Connect your Ethereum wallet (MetaMask, WalletConnect, etc.) to prove you control an address.
				</p>
				{#if !walletConnected}
					<button onclick={connectWallet}>Connect Wallet</button>
				{:else}
					<div class="proof-box">
						<code>{ethAddress}</code>
					</div>
					<p style="color: var(--green); font-size: 13px; margin-top: 8px;">Wallet connected</p>
				{/if}
			</div>
		</div>

		{#if walletConnected}
			<div class="card">
				<div class="card-header">Step 2: Sign Proof Message</div>
				<div class="card-body">
					<p style="color: var(--text-dim); font-size: 14px; margin-bottom: 12px;">
						Sign a message with your wallet to cryptographically link your Ethereum address to your identity.
						No transaction is sent — this is a free signature.
					</p>
					<div class="proof-box" style="margin-bottom: 12px;">
						<div style="font-size: 12px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">I am verifying my identity.

aspe:login2.link42.app:{identity.fingerprint}
ethereum:{ethAddress}</div>
					</div>
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
