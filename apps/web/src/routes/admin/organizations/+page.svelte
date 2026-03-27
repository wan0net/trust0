<script lang="ts">
	import { onMount } from "svelte";
	import type { Organization } from "$lib/api";

	const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

	let organizations = $state<(Organization & { exempt?: boolean })[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let showCreate = $state(false);
	let newName = $state("");
	let newSlug = $state("");
	let creating = $state(false);

	onMount(async () => {
		await loadOrgs();
	});

	async function loadOrgs() {
		loading = true;
		try {
			const res = await fetch(`${API_BASE}/api/auth/organization/list`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			organizations = (data as (Organization & { exempt?: boolean })[]) ?? [];
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load organizations";
		}
		loading = false;
	}

	async function createOrg() {
		if (!newName.trim()) return;
		creating = true;
		try {
			const res = await fetch(`${API_BASE}/api/auth/organization/create`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newName.trim(),
					slug: newSlug.trim() || newName.trim().toLowerCase().replace(/\s+/g, "-"),
				}),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			newName = "";
			newSlug = "";
			showCreate = false;
			await loadOrgs();
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to create organization";
		}
		creating = false;
	}

	async function toggleExempt(org: Organization & { exempt?: boolean }) {
		const newValue = !org.exempt;
		try {
			const res = await fetch(`${API_BASE}/api/organizations/${org.id}/exempt`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ exempt: newValue }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			org.exempt = newValue;
			organizations = [...organizations];
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to update exempt status";
		}
	}
</script>

<div class="page-header">
	<h1>Organizations</h1>
	<p>Manage organizations, members, and teams.</p>
</div>

<div style="margin-bottom: 16px;">
	<button class="outline" onclick={() => (showCreate = !showCreate)}>
		{showCreate ? "Cancel" : "Create Organization"}
	</button>
</div>

{#if showCreate}
	<div class="card" style="margin-bottom: 20px;">
		<div class="card-header">New Organization</div>
		<div class="card-body">
			<form onsubmit={(e) => { e.preventDefault(); createOrg(); }}>
				<div class="grid">
					<label>
						Name
						<input type="text" bind:value={newName} placeholder="My Organization" required />
					</label>
					<label>
						Slug (optional)
						<input type="text" bind:value={newSlug} placeholder="my-organization" />
					</label>
				</div>
				<button type="submit" aria-busy={creating} disabled={creating}>Create</button>
			</form>
		</div>
	</div>
{/if}

{#if loading}
	<p aria-busy="true">Loading organizations...</p>
{:else if error}
	<div class="error-state">{error}</div>
{:else if organizations.length === 0}
	<div class="empty-state">No organizations yet. Create one to get started.</div>
{:else}
	<figure>
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Slug</th>
					<th>Access</th>
					<th>Created</th>
				</tr>
			</thead>
			<tbody>
				{#each organizations as org}
					<tr>
						<td>
							<div class="org-cell">
								{#if org.logo}
									<img src={org.logo} alt="" class="org-logo" />
								{/if}
								<strong>{org.name}</strong>
							</div>
						</td>
						<td><code>{org.slug}</code></td>
						<td>
							<button
								class="pill-toggle"
								class:on={org.exempt}
								onclick={() => toggleExempt(org)}
							>
								{org.exempt ? "Free (exempt)" : "Paid"}
							</button>
						</td>
						<td class="date">{new Date(org.createdAt).toLocaleDateString()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</figure>
{/if}

<style>
	.org-cell {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.org-logo {
		width: 24px;
		height: 24px;
		border-radius: 4px;
	}

	.date {
		color: var(--text-dim);
		font-size: 12px;
	}
</style>
