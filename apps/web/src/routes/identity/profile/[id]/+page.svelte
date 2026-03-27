<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { parseProfile, verifyChain, type ChainState } from "@link42/identity";
	import { Claim, enums } from "doipjs";
	import { fetchChain, fetchIdentityById, type ChainResponse } from "$lib/identity";

	const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";
	const PROXY_HOSTNAME = import.meta.env.VITE_PROXY_URL || "http://localhost:8790";

	interface ClaimVerification {
		uri: string;
		service: string;
		status: "pending" | "verified" | "failed" | "unsupported";
		detail?: string;
	}

	interface Attestation {
		id: string;
		type: string;
		platform: string;
		platformUsername: string;
		value: string;
		attestedBy: string;
		attestedAt: string;
	}

	let profileName = $state("");
	let profileDescription = $state<string | undefined>(undefined);
	let profileAvatarUrl = $state<string | undefined>(undefined);
	let profileColor = $state<string | undefined>(undefined);
	let fingerprint = $state("");
	let username = $state<string | null>(null);
	let claims = $state<ClaimVerification[]>([]);
	let chain = $state<ChainResponse | null>(null);
	let chainState = $state<ChainState | null>(null);
	let chainVerified = $state<boolean | null>(null);
	let attestations = $state<Attestation[]>([]);
	let qrSvg = $state("");
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		const id = page.params.id;

		try {
			let profileJws: string;

			// 52-char uppercase BASE32 = identity ID
			// 26-char uppercase BASE32 = fingerprint
			// anything else = username
			if (/^[A-Z2-7]{52}$/.test(id)) {
				// Fetch by identity ID
				const identity = await fetchIdentityById(id);
				if (!identity) throw new Error("Identity not found");
				profileJws = identity.profileJws;
				fingerprint = identity.fingerprint;
				username = identity.username;
				chain = await fetchChain(id);
			} else if (/^[A-Z2-7]{26}$/.test(id)) {
				// Fetch by fingerprint
				const res = await fetch(`${API_BASE}/.well-known/aspe/id/${id}`);
				if (!res.ok) throw new Error("Profile not found");
				profileJws = await res.text();
				fingerprint = id;
			} else {
				// Fetch by username
				const res = await fetch(`${API_BASE}/api/identity/username/${id}`);
				if (!res.ok) throw new Error("Username not found");
				const data = await res.json() as { username: string; fingerprint: string; profileJws: string };
				profileJws = data.profileJws;
				fingerprint = data.fingerprint;
				username = data.username;
			}

			const parsed = await parseProfile(profileJws);
			profileName = parsed.name;
			profileDescription = parsed.description;
			profileAvatarUrl = parsed.avatarUrl;
			profileColor = parsed.color;

			// Initialize claims with pending status
			claims = parsed.claims.map(uri => ({
				uri,
				service: detectService(uri),
				status: "pending" as const,
			}));

			// Fetch chain if not already fetched (identity ID route fetches it above)
			if (!chain) {
				chain = await fetchChain(fingerprint);
			}

			// Verify chain client-side
			if (chain && chain.links.length > 0) {
				try {
					const jwsList = chain.links.map(l => l.linkJws);
					chainState = await verifyChain(jwsList, chain.identityId);
					chainVerified = true;
				} catch (err) {
					console.error("Chain verification failed:", err);
					chainVerified = false;
				}
			}

			// Fetch server attestations
			try {
				const attestRes = await fetch(`${API_BASE}/api/identity/attestations/${fingerprint}`);
				if (attestRes.ok) {
					const attestData = await attestRes.json() as { attestations: Attestation[] };
					attestations = attestData.attestations || [];
				}
			} catch {
				/* attestations are supplementary — don't fail the page */
			}

			// Generate QR code for profile URL
			try {
				// @ts-ignore — qrcode-svg has no type declarations
				const QRCode = (await import("qrcode-svg")).default;
				const profileUrl = window.location.href;
				const qr = new QRCode({ content: profileUrl, width: 128, height: 128, padding: 0, join: true });
				qrSvg = qr.svg();
			} catch { /* QR generation is supplementary */ }

			loading = false;

			// Verify each claim asynchronously (non-blocking)
			for (let i = 0; i < claims.length; i++) {
				const result = await verifyClaim(claims[i].uri, fingerprint);
				claims[i] = result;
				claims = [...claims]; // trigger reactivity
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load profile";
			loading = false;
		}
	});

	function detectService(uri: string): string {
		if (uri.startsWith("mailto:")) return "Email";
		if (uri.startsWith("dns:")) return "DNS";
		if (uri.startsWith("discord:")) return "Discord";
		if (uri.startsWith("telegram:")) return "Telegram";
		try {
			const url = new URL(uri);
			const host = url.hostname.replace("www.", "");
			if (host.includes("github")) return "GitHub";
			if (host.includes("twitter") || host.includes("x.com")) return "Twitter/X";
			if (host.includes("mastodon") || uri.includes("/@")) return "Mastodon";
			return host;
		} catch {
			return "Unknown";
		}
	}

	async function verifyClaim(uri: string, fingerprint: string): Promise<ClaimVerification> {
		// Email — server-attested, not verifiable by doipjs
		if (uri.startsWith("mailto:")) {
			try {
				const claimedEmail = uri.replace("mailto:", "");
				const res = await fetch(`${API_BASE}/api/identity/verify-email/${fingerprint}?email=${encodeURIComponent(claimedEmail)}`);
				if (!res.ok) return { uri, service: "Email", status: "failed", detail: "No email attestation found" };
				const data = await res.json() as { attested: boolean };
				if (data.attested) {
					return { uri, service: "Email", status: "verified", detail: "Attested by login2 server" };
				}
				return { uri, service: "Email", status: "failed", detail: "Email does not match attestation" };
			} catch {
				return { uri, service: "Email", status: "failed", detail: "Verification error" };
			}
		}

		// All other claims — use doipjs
		try {
			const claim = new Claim(uri, fingerprint);
			claim.match();

			if (claim.matches.length === 0) {
				return { uri, service: detectService(uri), status: "unsupported" as const, detail: "No matching service provider" };
			}

			await claim.verify({
				proxy: {
					hostname: PROXY_HOSTNAME,
					policy: "adaptive",
				},
			});

			const serviceName = claim.matches[0]?.about?.name ?? detectService(uri);

			if (claim.status === enums.ClaimStatus.VERIFIED || claim.status === enums.ClaimStatus.VERIFIED_VIA_PROXY) {
				return { uri, service: serviceName, status: "verified" as const };
			} else {
				return { uri, service: serviceName, status: "failed" as const, detail: "Proof not found" };
			}
		} catch (err) {
			return { uri, service: detectService(uri), status: "failed" as const, detail: err instanceof Error ? err.message : "Verification error" };
		}
	}

	function findAttestationForClaim(uri: string): Attestation | undefined {
		if (uri.startsWith("discord:")) {
			const userId = uri.replace("discord:", "");
			return attestations.find(a => a.platform === "discord" && a.value === userId);
		}
		if (uri.startsWith("telegram:")) {
			const userId = uri.replace("telegram:", "");
			return attestations.find(a => a.platform === "telegram" && a.value === userId);
		}
		if (uri.startsWith("mailto:")) {
			const email = uri.replace("mailto:", "");
			return attestations.find(a => a.platform === "email" && a.value === email);
		}
		return undefined;
	}

	function getUnmatchedAttestations(): Attestation[] {
		const claimUris = new Set(claims.map(c => c.uri));
		return attestations.filter(a => {
			if (a.platform === "discord") return !claimUris.has(`discord:${a.value}`);
			if (a.platform === "telegram") return !claimUris.has(`telegram:${a.value}`);
			if (a.platform === "email") return !claimUris.has(`mailto:${a.value}`);
			return true;
		});
	}

	function formatAttestationDisplay(a: Attestation): string {
		if (a.platform === "discord") return `Discord: @${a.platformUsername}`;
		if (a.platform === "telegram") return `Telegram: @${a.platformUsername}`;
		if (a.platform === "email") return `Email: ${a.value}`;
		return `${a.platform}: ${a.platformUsername || a.value}`;
	}

	async function copyFingerprint() {
		await navigator.clipboard.writeText(fingerprint);
	}
</script>

<svelte:head>
	{#if profileName}
		<title>{profileName}'s Identity — link42</title>
		<meta name="description" content={profileDescription || `Verified cryptographic identity for ${profileName}`} />
		<meta property="og:title" content={`${profileName}'s Verified Identity`} />
		<meta property="og:description" content={profileDescription || `Cryptographic identity with ${claims.length} verified claims`} />
		<meta property="og:type" content="profile" />
		<meta property="og:url" content={`https://login2.link42.app/identity/profile/${page.params.id}`} />
		<meta property="og:site_name" content="link42 Identity" />
		<meta name="twitter:card" content="summary" />
		<meta name="twitter:title" content={`${profileName}'s Verified Identity`} />
		<meta name="twitter:description" content={profileDescription || `Cryptographic identity with ${claims.length} verified claims`} />
	{:else}
		<title>Identity Profile — link42</title>
	{/if}
</svelte:head>

<div class="page-header">
	<h1>{profileName ? `${profileName}'s Identity` : 'Identity Profile'}</h1>
	<p>Cryptographic identity profile</p>
</div>

{#if loading}
	<p aria-busy="true">Loading profile...</p>
{:else if error}
	<div class="error-state" style="color: var(--red); margin-bottom: 16px;">
		{error}
	</div>
{:else}
	<div class="grid">
		<div class="card" style={profileColor ? `border-top: 3px solid ${profileColor}` : ""}>
			<div class="card-header">Profile Info</div>
			<div class="card-body">
				{#if profileAvatarUrl}
					<div class="profile-detail" style="text-align: center;">
						<img src={profileAvatarUrl} alt="{profileName}'s avatar" class="profile-avatar" />
					</div>
				{/if}

				<div class="profile-detail">
					<strong>Fingerprint</strong>
					<div class="fingerprint-row">
						<code>{fingerprint}</code>
						<button class="btn-sm secondary" onclick={copyFingerprint}>Copy</button>
					</div>
				</div>

				<div class="profile-detail">
					<strong>Name</strong>
					<div>{profileName}</div>
				</div>

				{#if username}
					<div class="profile-detail">
						<strong>Username</strong>
						<div>@{username}</div>
					</div>
				{/if}

				{#if profileDescription}
					<div class="profile-detail">
						<strong>Description</strong>
						<div>{profileDescription}</div>
					</div>
				{/if}

				{#if profileColor}
					<div class="profile-detail">
						<strong>Theme Color</strong>
						<div style="display: flex; align-items: center; gap: 8px;">
							<span style="display: inline-block; width: 20px; height: 20px; border-radius: 4px; background: {profileColor};"></span>
							<code>{profileColor}</code>
						</div>
					</div>
				{/if}

				{#if qrSvg}
					<div class="qr-section">
						<div class="qr-code">
							{@html qrSvg}
						</div>
						<p class="qr-label">Scan to view profile</p>
					</div>
				{/if}
			</div>
		</div>

		<div class="card">
			<div class="card-header">Verified Claims</div>
			<div class="card-body">
				{#if claims.length === 0 && attestations.length === 0}
					<p style="color: var(--text-dim);">This profile has no verified claims yet.</p>
				{:else}
					<div class="claims-list">
						{#each claims as claim}
							{@const attestation = findAttestationForClaim(claim.uri)}
							<div class="claim-card">
								<div class="claim-header">
									{#if attestation}
										<span class="badge accent" title="Attested by {attestation.attestedBy}">SERVER-ATTESTED</span>
									{:else if claim.status === 'pending'}
										<span class="badge amber" aria-busy="true">CHECKING</span>
									{:else if claim.status === 'verified'}
										<span class="badge green">VERIFIED</span>
									{:else if claim.status === 'failed'}
										<span class="badge red">FAILED</span>
									{:else}
										<span class="badge">UNSUPPORTED</span>
									{/if}
									<strong>{claim.service}</strong>
								</div>
							<div class="claim-uri">
								{#if claim.uri.startsWith('https://')}
									<a href={claim.uri} target="_blank" rel="noopener noreferrer">{claim.uri}</a>
								{:else if claim.uri.startsWith('mailto:')}
									<a href={claim.uri}>{claim.uri.replace('mailto:', '')}</a>
								{:else if claim.uri.startsWith('discord:') || claim.uri.startsWith('telegram:')}
									<span>{attestation ? formatAttestationDisplay(attestation) : claim.uri}</span>
								{:else}
									<code>{claim.uri}</code>
								{/if}
							</div>
								{#if attestation}
									<div class="claim-detail">Attested by {attestation.attestedBy} on {new Date(attestation.attestedAt).toLocaleDateString()}</div>
								{:else if claim.detail}
									<div class="claim-detail">{claim.detail}</div>
								{/if}
							</div>
						{/each}
						{#each getUnmatchedAttestations() as attestation}
							<div class="claim-card">
								<div class="claim-header">
									<span class="badge accent" title="Attested by {attestation.attestedBy}">SERVER-ATTESTED</span>
									<strong>{attestation.platform === 'discord' ? 'Discord' : attestation.platform === 'telegram' ? 'Telegram' : attestation.platform === 'email' ? 'Email' : attestation.platform}</strong>
								</div>
								<div class="claim-uri">
									<span>{formatAttestationDisplay(attestation)}</span>
								</div>
								<div class="claim-detail">Attested by {attestation.attestedBy} on {new Date(attestation.attestedAt).toLocaleDateString()}</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		{#if chain && chain.links.length > 0}
			<div class="card">
				<div class="chain-header">
					<h3>Signature Chain</h3>
					{#if chainVerified === true}
						<span class="badge green">CHAIN VALID</span>
					{:else if chainVerified === false}
						<span class="badge red">CHAIN INVALID</span>
					{:else}
						<span class="badge amber" aria-busy="true">VERIFYING</span>
					{/if}
				</div>
				{#if chain.identityId}
					<div class="profile-detail">
						<strong>Identity ID</strong>
						<code>{chain.identityId}</code>
					</div>
				{/if}
				<p class="chain-meta">{chain.links.length} signed link{chain.links.length === 1 ? '' : 's'}</p>
				<div class="chain-links">
					{#each chain.links as link}
						<div class="chain-link">
							<span class="link-seqno">#{link.seqno}</span>
							<span class="link-type-badge">{link.type}</span>
							<span class="link-time">{new Date(link.createdAt).toLocaleDateString()}</span>
						</div>
					{/each}
				</div>
				<p class="chain-verify-note">Chain verified client-side in your browser.</p>
			</div>
		{/if}
	</div>

	<div class="verification-notice">
		<small>Client verifications performed in your browser. Server-attested claims were witnessed by the platform's verification bots.</small>
	</div>
{/if}

<style>
	.fingerprint-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.profile-detail {
		margin-bottom: 16px;
	}

	.profile-detail:last-child {
		margin-bottom: 0;
	}

	.profile-detail strong {
		display: block;
		font-size: 12px;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 4px;
	}

	.profile-avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		object-fit: cover;
	}

	.claims-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.claim-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
		background: var(--bg-subtle);
	}

	.claim-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.claim-uri {
		margin-bottom: 4px;
		word-break: break-all;
	}

	.claim-detail {
		font-size: 12px;
		color: var(--text-dim);
	}

	.verification-notice {
		margin-top: 24px;
		text-align: center;
	}

	.chain-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.chain-header h3 {
		margin: 0;
	}

	.chain-meta {
		color: var(--text-dim);
		margin-bottom: 12px;
		font-size: 14px;
	}

	.chain-links {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.chain-link {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
		background: var(--bg-subtle);
		border-radius: 8px;
		font-size: 14px;
	}

	.link-seqno {
		font-weight: 600;
		color: var(--text-dim);
		min-width: 2rem;
	}

	.link-type-badge {
		font-family: var(--font-mono, monospace);
		background: var(--accent, teal);
		color: white;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 12px;
	}

	.link-time {
		color: var(--text-dim);
		margin-left: auto;
		font-size: 12px;
	}

	.chain-verify-note {
		margin-top: 12px;
		font-size: 12px;
		color: var(--text-dim);
		font-style: italic;
	}

	.qr-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.qr-code {
		background: white;
		padding: 8px;
		border-radius: 8px;
		border: 1px solid var(--border);
		display: inline-block;
	}

	.qr-code :global(svg) {
		width: 128px;
		height: 128px;
		display: block;
	}

	.qr-label {
		font-size: 0.75rem;
		color: var(--text-dim);
		margin-top: 8px;
	}
</style>