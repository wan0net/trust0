<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import { getMe } from "$lib/api";

	let { children } = $props();
	let user = $state<{ name: string; email: string; image: string | null } | null>(null);

	onMount(async () => {
		const me = await getMe();
		user = me;
	});
</script>

<nav class="topbar">
	<div class="topbar-inner">
		<a href="/" class="logo">
			<span class="logo-text">trust<span class="logo-zero">0</span></span>
		</a>
		<div class="nav-links">
			{#if user}
				<a href="/identity">Identity</a>
				<a href="/identity/sign">Sign</a>
				<span class="user-name">{user.name}</span>
			{:else}
				<a href="/api/auth/sign-in/social?provider=github" class="btn-login">Sign in with GitHub</a>
			{/if}
		</div>
	</div>
</nav>

<main class="container">
	{@render children()}
</main>

<footer class="site-footer">
	<div class="container">
		<p>trust0 — Trust no one. Verify everything.</p>
		<p class="footer-links">
			<a href="https://github.com/wan0net/trust0">Source</a>
			<span class="sep">·</span>
			<a href="https://ariadne.id">Ariadne Spec</a>
			<span class="sep">·</span>
			Open source (AGPL-3.0)
		</p>
	</div>
</footer>

<style>
	.topbar {
		border-bottom: 1px solid var(--border);
		padding: 12px 24px;
		position: sticky;
		top: 0;
		background: var(--bg);
		z-index: 100;
	}

	.topbar-inner {
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.logo { text-decoration: none; color: var(--text); }

	.logo-text {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		font-family: var(--font-mono);
	}

	.logo-zero { color: var(--accent); }

	.nav-links {
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: 0.875rem;
	}

	.nav-links a { color: var(--text-dim); }
	.nav-links a:hover { color: var(--text); text-decoration: none; }
	.user-name { color: var(--text-dim); font-size: 0.8rem; }

	.btn-login {
		padding: 6px 14px;
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text) !important;
		font-weight: 500;
	}

	.btn-login:hover { background: var(--bg-subtle); text-decoration: none !important; }

	main {
		padding-top: 32px;
		padding-bottom: 64px;
		min-height: calc(100vh - 180px);
	}

	.site-footer {
		border-top: 1px solid var(--border);
		padding: 24px;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-dim);
	}

	.footer-links { margin-top: 4px; }
	.sep { margin: 0 4px; opacity: 0.3; }
</style>
