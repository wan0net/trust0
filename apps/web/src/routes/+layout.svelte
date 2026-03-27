<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { getMe, devLogout, checkDevMode, signOut } from "$lib/api";
	import { Toast, PlatformBar, Header, Footer } from "@link42/ui";
	import "@link42/tokens";
	import "../brand.css";
	import "@link42/ui/patterns.css";

	let { data, children } = $props();
	let meUser = $state<{ name: string; email: string; image: string | null } | null>(null);
	let devMode = $state(false);
	let theme = $state<"light" | "dark">(data.theme as "light" | "dark");
	onMount(async () => {
		const [me, isDev] = await Promise.all([getMe(), checkDevMode()]);
		devMode = isDev;
		if (me) {
			meUser = { name: me.user.name, email: me.user.email, image: me.user.image };
		}
	});

	function setThemeCookie(t: string) {
		document.cookie = `theme=${t};path=/;domain=.link42.app;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
	}

	function toggleTheme() {
		const next = theme === "light" ? "dark" : "light";
		document.documentElement.setAttribute("data-theme", next);
		setThemeCookie(next);
		theme = next;
	}

	async function handleSignOut() {
		if (devMode) {
			await devLogout();
		}
		await signOut();
		meUser = null;
		goto("/");
	}
</script>

<div class="cl-page">
	<PlatformBar
		currentApp="login2"
		user={meUser}
		signInHref="/"
		accountHref="/"
		onSignOut={handleSignOut}
	/>
	<Header
		appName="login2"
		navItems={[
			{ href: "/admin", label: "Dashboard" },
			{ href: "/admin/users", label: "Users" },
			{ href: "/admin/organizations", label: "Orgs" },
			{ href: "/admin/subscriptions", label: "Billing" },
			{ href: "/admin/apps", label: "Apps" },
			{ href: "/identity", label: "Identity" },
		]}
		activePath={page.url.pathname}
		theme={theme}
		onToggleTheme={toggleTheme}
	/>

	<main class="container" style="flex: 1; padding-top: 28px; padding-bottom: 28px;">
		{@render children()}
	</main>

	<Footer appName="login2" attribution="Centralized Identity Platform" />
	{#if devMode}
		<span class="dev-badge">DEV</span>
	{/if}

	<Toast />
</div>

<style>
	.dev-badge {
		position: fixed;
		bottom: 8px;
		right: 8px;
		background: var(--amber);
		color: white;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 4px;
		z-index: 999;
	}
</style>
