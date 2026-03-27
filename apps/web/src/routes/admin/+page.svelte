<script lang="ts">
	import { onMount } from "svelte";
	import { getMe, type MeResponse } from "$lib/api";

	let me = $state<MeResponse | null>(null);
	let loading = $state(true);

	onMount(async () => {
		me = await getMe();
		loading = false;
	});
</script>

<div class="page-header">
	<h1>Dashboard</h1>
</div>

{#if loading}
	<p aria-busy="true">Loading...</p>
{:else if !me}
	<div class="empty-state">
		<p>You are not signed in. <a href="/">Sign in</a> to continue.</p>
	</div>
{:else}
	<div class="grid">
		<div class="card">
			<div class="card-header">Current User</div>
			<div class="card-body">
				<div class="user-row">
					{#if me.user.image}
						<img src={me.user.image} alt={me.user.name} class="avatar" />
					{/if}
					<div>
						<strong>{me.user.name}</strong>
						<div class="meta">{me.user.email}</div>
					</div>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Active Organization</div>
			<div class="card-body">
				{#if me.organization}
					<strong>{me.organization.name}</strong>
					<div class="meta">{me.organization.slug}</div>
					<div class="meta">{me.organization.members?.length ?? 0} members</div>
				{:else}
					<p style="color: var(--text-dim);">No active organization</p>
					<a href="/admin/organizations" role="button" class="outline btn-sm" style="margin-top: 8px;">
						Manage Organizations
					</a>
				{/if}
			</div>
		</div>

		<div class="card">
			<div class="card-header">Cryptographic Identity</div>
			<div class="card-body">
				<p style="color: var(--text-dim); font-size: 13px;">
					Prove ownership of your accounts with cryptographic keys.
				</p>
				<a href="/identity" role="button" class="outline btn-sm" style="margin-top: 8px;">
					Manage Identity
				</a>
			</div>
		</div>
	</div>

	<div style="margin-top: 16px;">
		<div class="card">
			<div class="card-header">Quick Links</div>
			<div class="card-body">
				<ul>
					<li><a href="/admin/users">Manage Users</a></li>
					<li><a href="/admin/organizations">Manage Organizations</a></li>
					<li><a href="/admin/subscriptions">Manage Subscriptions</a></li>
					<li><a href="/admin/apps">Manage Apps</a></li>
				</ul>
			</div>
		</div>
	</div>
{/if}

<style>
	.user-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}

	.meta {
		font-size: 12px;
		color: var(--text-dim);
	}
</style>
