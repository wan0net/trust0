<script lang="ts">
	import { onMount } from "svelte";
	import type { User } from "$lib/api";

	const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

	let users = $state<User[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(`${API_BASE}/api/auth/admin/list-users`, {
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				method: "GET",
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			users = (data as { users: User[] }).users ?? [];
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load users";
		}
		loading = false;
	});
</script>

<div class="page-header">
	<h1>Users</h1>
	<p>All registered users across the platform.</p>
</div>

{#if loading}
	<p aria-busy="true">Loading users...</p>
{:else if error}
	<div class="error-state">{error}</div>
{:else if users.length === 0}
	<div class="empty-state">No users found.</div>
{:else}
	<figure>
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Email</th>
					<th>Joined</th>
				</tr>
			</thead>
			<tbody>
				{#each users as user}
					<tr>
						<td>
							<div class="user-cell">
								{#if user.image}
									<img src={user.image} alt="" class="avatar" />
								{/if}
								{user.name}
							</div>
						</td>
						<td>{user.email}</td>
						<td>{new Date(user.createdAt).toLocaleDateString()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</figure>
{/if}

<style>
	.user-cell {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}
</style>
