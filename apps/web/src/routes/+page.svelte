<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { getMe, signInWithProvider, checkDevMode, devLogin } from "$lib/api";

	let user = $state<{ name: string; email: string; image: string | null } | null>(null);
	let loading = $state(true);
	let devMode = $state(false);
	let devLoggingIn = $state(false);
	let signingIn = $state<string | null>(null);
	let theme = $state("light");

	async function handleSignIn(provider: string) {
		signingIn = provider;
		try {
			await signInWithProvider(provider);
		} catch {
			signingIn = null;
		}
	}

	onMount(async () => {
		theme = document.documentElement.getAttribute("data-theme") || "light";
		const [me, isDev] = await Promise.all([getMe(), checkDevMode()]);
		devMode = isDev;
		if (me) {
			user = me.user;
		}
		loading = false;
	});

	async function handleDevLogin() {
		devLoggingIn = true;
		const result = await devLogin();
		if (result) {
			goto("/admin");
		}
		devLoggingIn = false;
	}
</script>

<div class="login-page">
	<div class="landing-logo">
		<img src={theme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'} alt="trust0" />
	</div>
	<div class="login-card">
		{#if loading}
			<p aria-busy="true">Checking authentication...</p>
		{:else if user}
			<h2>Welcome back, {user.name}</h2>
			<p class="subtitle">{user.email}</p>
			<a href="/admin" role="button">Go to Dashboard</a>
		{:else}
			<h2>Sign in</h2>
			<p class="subtitle">Choose a provider to access the admin console.</p>

			{#if devMode}
				<button onclick={handleDevLogin} aria-busy={devLoggingIn} disabled={devLoggingIn}>
					Dev Login (no OAuth required)
				</button>
				<hr />
				<small>Dev mode is active. OAuth providers below require real credentials.</small>
				<div style="margin-top: 12px;"></div>
			{/if}

			<form class="provider-grid" onsubmit={(e) => e.preventDefault()}>
				<button type="button" onclick={() => handleSignIn("google")} class="outline" aria-busy={signingIn === "google"} disabled={!!signingIn}>Google</button>
				<button type="button" onclick={() => handleSignIn("github")} class="secondary" aria-busy={signingIn === "github"} disabled={!!signingIn}>GitHub</button>
				<button type="button" onclick={() => handleSignIn("discord")} class="secondary" aria-busy={signingIn === "discord"} disabled={!!signingIn}>Discord</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.login-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
	}

	.landing-logo {
		width: 120px;
		height: 120px;
		margin-bottom: 16px;
	}

	.landing-logo img {
		width: 100%;
		height: 100%;
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		padding: 32px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-card);
	}

	.login-card h2 {
		margin-top: 0;
		margin-bottom: 4px;
	}

	.subtitle {
		color: var(--text-dim);
		font-size: 13px;
		margin-bottom: 20px;
	}

	.provider-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.provider-grid button {
		width: 100%;
	}
</style>
