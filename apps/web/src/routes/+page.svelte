<script lang="ts">
	import { onMount } from "svelte";
	import { getMe, signInWithGitHub, type MeResponse } from "$lib/api";

	let me = $state<MeResponse | null>(null);
	let signingIn = $state(false);

	onMount(async () => {
		me = await getMe();
	});

	async function handleSignIn() {
		signingIn = true;
		try { await signInWithGitHub(); } catch { signingIn = false; }
	}
</script>

<div class="hero">
	<h1>trust<span class="zero">0</span></h1>
	<p class="tagline">Prove you are who you say you are.</p>
	<p class="subtitle">
		Link your accounts across GitHub, Mastodon, DNS, crypto wallets, and 20+ platforms
		with cryptographic proof. Anyone can verify — no trust required.
	</p>

	{#if me}
		<a href="/identity" role="button" class="cta">Go to My Identity</a>
	{:else}
		<button class="cta" onclick={handleSignIn} disabled={signingIn}>
			{signingIn ? "Redirecting..." : "Get Started — Sign in with GitHub"}
		</button>
	{/if}
</div>

<div class="steps">
	<div class="step">
		<div class="step-num">1</div>
		<div class="step-content">
			<h3>Create your identity</h3>
			<p>Sign in with GitHub. Your browser generates a unique cryptographic key. Your private key never leaves your device.</p>
		</div>
	</div>
	<div class="step">
		<div class="step-num">2</div>
		<div class="step-content">
			<h3>Link your accounts</h3>
			<p>Post a small proof on each platform you own — a GitHub Gist, a DNS record, a tweet, a Mastodon bio. This proves you control that account.</p>
		</div>
	</div>
	<div class="step">
		<div class="step-num">3</div>
		<div class="step-content">
			<h3>Share your verified profile</h3>
			<p>Get a single link that shows all your verified accounts. Anyone who visits it can independently verify every proof — in their own browser.</p>
		</div>
	</div>
</div>

<div class="features">
	<div class="feature">
		<h3>No server trust</h3>
		<p>Verification happens in the viewer's browser. The server stores your profile — it can't forge results.</p>
	</div>
	<div class="feature">
		<h3>Key rotation</h3>
		<p>Lost your key? Rotate to a new one. Your identity survives — the sigchain preserves continuity.</p>
	</div>
	<div class="feature">
		<h3>Sign documents</h3>
		<p>Sign files with your verified identity. Timestamps via Sigstore. Others can verify who signed and when.</p>
	</div>
	<div class="feature">
		<h3>Your data, portable</h3>
		<p>Export your identity anytime. Host it yourself. If this server disappears, your identity survives.</p>
	</div>
</div>

<div class="providers-section">
	<h2>20+ platforms supported</h2>
	<div class="provider-tags">
		<span class="tag">GitHub</span>
		<span class="tag">GitLab</span>
		<span class="tag">Mastodon</span>
		<span class="tag">Bluesky</span>
		<span class="tag">Twitter/X</span>
		<span class="tag">Reddit</span>
		<span class="tag">Hacker News</span>
		<span class="tag">DNS</span>
		<span class="tag">Website</span>
		<span class="tag">Ethereum</span>
		<span class="tag">Bitcoin</span>
		<span class="tag">Solana</span>
		<span class="tag">Nostr</span>
		<span class="tag">Discord</span>
		<span class="tag">Telegram</span>
		<span class="tag">Email</span>
		<span class="tag">ORCID</span>
		<span class="tag">Sourcehut</span>
		<span class="tag">Lobsters</span>
		<span class="tag">Keybase</span>
	</div>
</div>

<div class="compat">
	<p>
		Open source. Built on the <a href="https://ariadne.id">Ariadne specification</a>.
		Compatible with <a href="https://keyoxide.org">Keyoxide</a>.
		<a href="https://github.com/wan0net/trust0">View source on GitHub.</a>
	</p>
</div>

<style>
	.hero {
		text-align: center;
		padding: 72px 0 48px;
	}

	.hero h1 {
		font-family: var(--font-mono);
		font-size: 4rem;
		font-weight: 700;
		letter-spacing: -0.05em;
		margin-bottom: 12px;
	}

	.zero { color: var(--accent); }

	.tagline {
		font-size: 1.4rem;
		color: var(--text);
		font-weight: 500;
		margin-bottom: 12px;
	}

	.subtitle {
		max-width: 540px;
		margin: 0 auto 32px;
		color: var(--text-dim);
		font-size: 1rem;
		line-height: 1.7;
	}

	.cta {
		background: var(--accent);
		color: #000;
		padding: 14px 32px;
		border-radius: 8px;
		font-weight: 600;
		font-size: 1rem;
		border: none;
		cursor: pointer;
		font-family: var(--font-sans);
		text-decoration: none;
		display: inline-block;
	}

	.cta:hover { opacity: 0.85; }
	.cta:disabled { opacity: 0.6; cursor: wait; }

	/* ── Steps ──────────────────────────────────── */

	.steps {
		max-width: 560px;
		margin: 0 auto;
		padding: 48px 0;
	}

	.step {
		display: flex;
		gap: 16px;
		margin-bottom: 28px;
	}

	.step-num {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--accent);
		color: #000;
		font-weight: 700;
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.step-content h3 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.step-content p {
		font-size: 0.9rem;
		color: var(--text-dim);
		line-height: 1.6;
	}

	/* ── Features ───────────────────────────────── */

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
		padding: 32px 0 48px;
	}

	.feature {
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-subtle);
	}

	.feature h3 {
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 6px;
		color: var(--accent);
	}

	.feature p {
		font-size: 0.85rem;
		color: var(--text-dim);
		line-height: 1.6;
	}

	/* ── Providers ──────────────────────────────── */

	.providers-section {
		text-align: center;
		padding: 32px 0;
		border-top: 1px solid var(--border);
	}

	.providers-section h2 {
		font-size: 1.1rem;
		margin-bottom: 16px;
		font-weight: 600;
	}

	.provider-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
	}

	.tag {
		padding: 4px 12px;
		border: 1px solid var(--border);
		border-radius: 20px;
		font-size: 0.8rem;
		color: var(--text-dim);
	}

	/* ── Compat ─────────────────────────────────── */

	.compat {
		text-align: center;
		padding: 32px 0;
		font-size: 0.85rem;
		color: var(--text-dim);
	}

	.compat a { color: var(--accent); }
</style>
