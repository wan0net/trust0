<script lang="ts">
	import { onMount } from "svelte";

	const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

	interface App {
		id: string;
		name: string;
		slug: string;
		free: boolean;
		apiKey: string | null;
		description: string | null;
		url: string | null;
		createdAt: string;
	}

	let apps = $state<App[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let revealedKeys = $state<Set<string>>(new Set());

	let showCreate = $state(false);
	let newName = $state("");
	let newSlug = $state("");
	let newDescription = $state("");
	let newUrl = $state("");
	let newFree = $state(false);
	let creating = $state(false);

	onMount(async () => {
		await loadApps();
	});

	async function loadApps() {
		loading = true;
		try {
			const res = await fetch(`${API_BASE}/api/apps`, { credentials: "include" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			apps = (await res.json()) as App[];
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load apps";
		}
		loading = false;
	}

	async function createApp() {
		if (!newName.trim()) return;
		creating = true;
		try {
			const res = await fetch(`${API_BASE}/api/apps`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newName.trim(),
					slug: newSlug.trim() || newName.trim().toLowerCase().replace(/\s+/g, "-"),
					free: newFree,
					description: newDescription.trim() || undefined,
					url: newUrl.trim() || undefined,
				}),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			newName = "";
			newSlug = "";
			newDescription = "";
			newUrl = "";
			newFree = false;
			showCreate = false;
			await loadApps();
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to create app";
		}
		creating = false;
	}

	async function toggleFree(app: App) {
		const newValue = !app.free;
		try {
			const res = await fetch(`${API_BASE}/api/apps/${app.id}/free`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ free: newValue }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			app.free = newValue;
			apps = [...apps];
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to update app";
		}
	}

	async function rotateKey(app: App) {
		try {
			const res = await fetch(`${API_BASE}/api/apps/${app.id}/rotate-key`, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { apiKey: string };
			app.apiKey = data.apiKey;
			apps = [...apps];
			revealedKeys = new Set([...revealedKeys, app.id]);
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to rotate key";
		}
	}

	function toggleReveal(appId: string) {
		const next = new Set(revealedKeys);
		if (next.has(appId)) {
			next.delete(appId);
		} else {
			next.add(appId);
		}
		revealedKeys = next;
	}

	async function copyKey(key: string) {
		await navigator.clipboard.writeText(key);
	}
</script>

<div class="page-header">
	<h1>Apps</h1>
	<p>Manage registered applications, access model, and API keys.</p>
</div>

<div style="margin-bottom: 16px;">
	<button class="outline" onclick={() => (showCreate = !showCreate)}>
		{showCreate ? "Cancel" : "Register App"}
	</button>
</div>

{#if showCreate}
	<div class="card" style="margin-bottom: 20px;">
		<div class="card-header">Register New App</div>
		<div class="card-body">
			<form onsubmit={(e) => { e.preventDefault(); createApp(); }}>
				<div class="grid">
					<label>
						Name
						<input type="text" bind:value={newName} placeholder="My App" required />
					</label>
					<label>
						Slug
						<input type="text" bind:value={newSlug} placeholder="my-app" />
					</label>
				</div>
				<label>
					Description
					<input type="text" bind:value={newDescription} placeholder="What this app does" />
				</label>
				<label>
					URL
					<input type="url" bind:value={newUrl} placeholder="https://app.example.com" />
				</label>
				<label>
					<input type="checkbox" bind:checked={newFree} />
					Free for all users (no subscription required)
				</label>
				<button type="submit" aria-busy={creating} disabled={creating}>Register</button>
			</form>
		</div>
	</div>
{/if}

{#if loading}
	<p aria-busy="true">Loading apps...</p>
{:else if error}
	<div class="error-state">{error}</div>
{:else if apps.length === 0}
	<div class="empty-state">No apps registered yet.</div>
{:else}
	<figure>
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Slug</th>
					<th>Access</th>
					<th>API Key</th>
					<th>URL</th>
				</tr>
			</thead>
			<tbody>
				{#each apps as a}
					<tr>
						<td>
							<strong>{a.name}</strong>
							{#if a.description}
								<div class="app-desc">{a.description}</div>
							{/if}
						</td>
						<td><code>{a.slug}</code></td>
						<td>
							<button
								class="pill-toggle"
								class:on={a.free}
								onclick={() => toggleFree(a)}
							>
								{a.free ? "Free" : "Paid"}
							</button>
						</td>
						<td class="key-cell">
							{#if a.apiKey}
								<div class="key-row">
									<code class="key-value">
										{revealedKeys.has(a.id) ? a.apiKey : "••••••••••••"}
									</code>
									<button class="btn-icon" onclick={() => toggleReveal(a.id)} title="Reveal">
										{revealedKeys.has(a.id) ? "🙈" : "👁"}
									</button>
									{#if revealedKeys.has(a.id)}
										<button class="btn-icon" onclick={() => copyKey(a.apiKey!)} title="Copy">
											📋
										</button>
									{/if}
								</div>
							{:else}
								<span class="dim">None</span>
							{/if}
							<button class="btn-sm secondary" onclick={() => rotateKey(a)} style="margin-top: 4px;">
								{a.apiKey ? "Rotate" : "Generate"}
							</button>
						</td>
						<td>
							{#if a.url}
								<a href={a.url} target="_blank" class="app-url">{a.url}</a>
							{:else}
								<span class="dim">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</figure>
{/if}

<style>
	.app-desc {
		font-size: 12px;
		color: var(--text-dim);
		margin-top: 2px;
	}

	.app-url {
		font-size: 12px;
		word-break: break-all;
	}

	.dim {
		color: var(--text-dim);
	}

	.key-cell {
		min-width: 200px;
	}

	.key-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.key-value {
		font-size: 11px;
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-icon {
		height: 24px;
		width: 24px;
		padding: 0;
		background: none;
		border: none;
		font-size: 13px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		color: var(--text-mid);
	}

	.btn-icon:hover {
		background: var(--bg-hover);
	}
</style>
