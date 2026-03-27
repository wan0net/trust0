<script lang="ts">
	import { onMount } from "svelte";
	import { getMe } from "$lib/api";

	let user = $state<{ name: string } | null>(null);

	onMount(async () => {
		user = await getMe();
	});
</script>

<div class="hero">
	<h1>trust<span class="zero">0</span></h1>
	<p class="tagline">Trust no one. Verify everything.</p>
	<p class="subtitle">
		Cryptographic identity verification. Prove you own your accounts across
		platforms using Ed25519 signatures and an append-only sigchain.
		All verification happens in your browser. Open source. Open data.
	</p>

	{#if user}
		<a href="/identity" role="button" class="cta">Go to Identity Dashboard</a>
	{:else}
		<a href="/api/auth/sign-in/social?provider=github" role="button" class="cta">Sign in with GitHub</a>
	{/if}
</div>

<div class="features">
	<div class="feature">
		<h3>Client-Side Verification</h3>
		<p>Your browser fetches proofs directly from platforms and verifies signatures.
		   The server stores bytes — it can't forge results.</p>
	</div>

	<div class="feature">
		<h3>Append-Only Sigchain</h3>
		<p>Every identity action is a signed, hash-linked chain entry.
		   Key rotation, proof revocation, and identity history — all auditable.</p>
	</div>

	<div class="feature">
		<h3>20+ Proof Providers</h3>
		<p>GitHub, GitLab, Mastodon, Bluesky, Twitter/X, Reddit, DNS, Ethereum,
		   Bitcoin, Solana, Nostr, and more. Client-verified or server-attested.</p>
	</div>

	<div class="feature">
		<h3>Document Signing</h3>
		<p>Sign files with your identity key. Rekor transparency log timestamps.
		   Multi-party signatures. SSH key export for git commits.</p>
	</div>

	<div class="feature">
		<h3>Portable Identity</h3>
		<p>Export your entire identity as a zip. Self-host on GitHub Pages, your
		   own domain, or anywhere. Your data works without this server.</p>
	</div>

	<div class="feature">
		<h3>Resilient by Design</h3>
		<p>If trust0.app disappears, your identity survives. Every piece of data
		   is a self-verifying signed file. Open source, forkable, redeployable.</p>
	</div>
</div>

<div class="ariadne-compat">
	<p>Built on the <a href="https://ariadne.id">Ariadne specification</a>.
	   Compatible with <a href="https://keyoxide.org">Keyoxide</a>.
	   Verification powered by <a href="https://codeberg.org/keyoxide/doipjs">doipjs</a> (forked as @trust0/verify).</p>
</div>

<style>
	.hero {
		text-align: center;
		padding: 64px 0 48px;
	}

	.hero h1 {
		font-family: var(--font-mono);
		font-size: 4rem;
		font-weight: 700;
		letter-spacing: -0.05em;
		margin-bottom: 8px;
	}

	.zero { color: var(--accent); }

	.tagline {
		font-size: 1.25rem;
		color: var(--text-dim);
		font-weight: 500;
		margin-bottom: 16px;
	}

	.subtitle {
		max-width: 600px;
		margin: 0 auto 32px;
		color: var(--text-dim);
		font-size: 0.95rem;
		line-height: 1.7;
	}

	.cta {
		background: var(--accent);
		color: #000;
		padding: 12px 32px;
		border-radius: 8px;
		font-weight: 600;
		font-size: 1rem;
		border: none;
	}

	.cta:hover { opacity: 0.85; text-decoration: none; }

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
		padding: 48px 0;
	}

	.feature {
		padding: 24px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-subtle);
	}

	.feature h3 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 8px;
		color: var(--accent);
	}

	.feature p {
		font-size: 0.875rem;
		color: var(--text-dim);
		line-height: 1.6;
	}

	.ariadne-compat {
		text-align: center;
		padding: 32px 0 48px;
		font-size: 0.85rem;
		color: var(--text-dim);
	}
</style>
