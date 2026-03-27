<script lang="ts">
	import { onMount } from "svelte";
	import {
		listSubscriptions,
		getPlans,
		upgradeSubscription,
		cancelSubscription,
		type Subscription,
		type Plan,
		type Organization,
	} from "$lib/api";

	const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

	let subscriptions = $state<Subscription[]>([]);
	let plans = $state<Plan[]>([]);
	let organizations = $state<Organization[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let selectedOrgId = $state<string>("");
	let upgrading = $state(false);
	let cancelling = $state(false);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [plansData, orgsRes] = await Promise.all([
				getPlans(),
				fetch(`${API_BASE}/api/auth/organization/list`, {
					credentials: "include",
				}),
			]);
			plans = plansData;
			if (orgsRes.ok) {
				const orgsData = await orgsRes.json();
				organizations = (orgsData as Organization[]) ?? [];
			}
			if (organizations.length > 0 && !selectedOrgId) {
				selectedOrgId = organizations[0].id;
			}
			if (selectedOrgId) {
				await loadSubscriptions();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load data";
		}
		loading = false;
	}

	async function loadSubscriptions() {
		if (!selectedOrgId) return;
		subscriptions = await listSubscriptions(selectedOrgId);
	}

	async function handleUpgrade(planName: string) {
		upgrading = true;
		error = null;
		const plan = plans.find((p) => p.name === planName);
		const result = await upgradeSubscription({
			plan: planName,
			referenceId: selectedOrgId,
			seats: plan?.seats,
		});
		if (result) {
			await loadSubscriptions();
		} else {
			error = "Failed to upgrade subscription";
		}
		upgrading = false;
	}

	async function handleCancel() {
		cancelling = true;
		error = null;
		const result = await cancelSubscription(selectedOrgId);
		if (result) {
			await loadSubscriptions();
		} else {
			error = "Failed to cancel subscription";
		}
		cancelling = false;
	}

	function orgName(orgId: string): string {
		return organizations.find((o) => o.id === orgId)?.name ?? orgId;
	}

	$effect(() => {
		if (selectedOrgId) {
			loadSubscriptions();
		}
	});
</script>

<div class="page-header">
	<h1>Subscriptions</h1>
	<p>Manage organization subscription plans and seats.</p>
</div>

{#if loading}
	<p aria-busy="true">Loading...</p>
{:else if error}
	<div class="error-state">{error}</div>
{:else}
	{#if organizations.length === 0}
		<div class="empty-state">
			No organizations found. <a href="/admin/organizations">Create one</a> first.
		</div>
	{:else}
		<label>
			Organization
			<select bind:value={selectedOrgId}>
				{#each organizations as org}
					<option value={org.id}>{org.name}</option>
				{/each}
			</select>
		</label>

		<h2>Current Subscription</h2>

		{#if subscriptions.length === 0}
			<div class="card" style="margin-bottom: 20px;">
				<div class="card-body">
					<p>No active subscription for <strong>{orgName(selectedOrgId)}</strong>.</p>
					<p style="color: var(--text-dim);">Choose a plan below to get started.</p>
				</div>
			</div>
		{:else}
			{#each subscriptions as sub}
				<div class="card sub-card">
					<div class="card-header sub-header">
						<strong class="plan-name">{sub.plan} Plan</strong>
						<span
							class="badge"
							class:active={sub.status === "active"}
							class:canceled={sub.status === "canceled"}
							class:trialing={sub.status === "trialing"}
						>
							{sub.status}
						</span>
					</div>
					<div class="card-body">
						<div class="sub-stats">
							<div class="stat">
								<div class="stat-label">Seats</div>
								<div class="stat-value">{sub.seats ?? "Unlimited"}</div>
							</div>
							<div class="stat">
								<div class="stat-label">Billing</div>
								<div class="stat-value capitalize">{sub.billingInterval ?? "—"}</div>
							</div>
							<div class="stat">
								<div class="stat-label">Period End</div>
								<div class="stat-value">
									{sub.periodEnd
										? new Date(sub.periodEnd).toLocaleDateString()
										: "—"}
								</div>
							</div>
						</div>
						{#if sub.cancelAtPeriodEnd}
							<mark>Cancels at period end</mark>
						{/if}
						{#if sub.status === "active"}
							<div style="margin-top: 12px;">
								<button
									class="secondary"
									onclick={handleCancel}
									aria-busy={cancelling}
									disabled={cancelling}
								>
									Cancel Subscription
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}

		<h2>Available Plans</h2>

		<div class="plan-grid">
			{#each plans as plan}
				{@const currentPlan = subscriptions.find(
					(s) => s.plan === plan.name && s.status === "active",
				)}
				<div class="card plan-card">
					<div class="card-header">{plan.label}</div>
					<div class="card-body">
						<div class="price">
							{#if plan.price === 0}
								Free
							{:else}
								${plan.price}<span class="price-unit">/mo</span>
							{/if}
						</div>
						<p class="seats">{plan.seats} seat{plan.seats !== 1 ? "s" : ""} included</p>
						{#if currentPlan}
							<button disabled>Current Plan</button>
						{:else}
							<button
								onclick={() => handleUpgrade(plan.name)}
								aria-busy={upgrading}
								disabled={upgrading}
							>
								{subscriptions.some((s) => s.status === "active") ? "Switch to" : "Subscribe to"} {plan.label}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<h2>Organization Members</h2>
		{#if organizations.find((o) => o.id === selectedOrgId)?.members?.length}
			{@const org = organizations.find((o) => o.id === selectedOrgId)}
			{@const activeSub = subscriptions.find((s) => s.status === "active")}
			<figure>
				<table>
					<thead>
						<tr>
							<th>User</th>
							<th>Role</th>
							<th>Seat Status</th>
						</tr>
					</thead>
					<tbody>
						{#each org?.members ?? [] as m, i}
							<tr>
								<td>{m.user?.name ?? m.userId}</td>
								<td><code>{m.role}</code></td>
								<td>
									{#if !activeSub}
										<span class="dim">No subscription</span>
									{:else if activeSub.seats && i < activeSub.seats}
										<span class="badge green">Assigned</span>
									{:else}
										<span class="badge red">No seat</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</figure>
		{:else}
			<p style="color: var(--text-dim);">No members in this organization.</p>
		{/if}
	{/if}
{/if}

<style>
	.sub-card {
		margin-bottom: 20px;
	}

	.sub-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.plan-name {
		text-transform: capitalize;
	}

	.sub-stats {
		display: flex;
		gap: 32px;
		margin-bottom: 12px;
	}

	.stat-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-dim);
		margin-bottom: 2px;
	}

	.stat-value {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}

	.capitalize {
		text-transform: capitalize;
	}

	.plan-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.plan-card .card-body {
		text-align: center;
	}

	.price {
		font-size: 28px;
		font-weight: 700;
		color: var(--text);
		margin: 8px 0;
		letter-spacing: -0.03em;
	}

	.price-unit {
		font-size: 14px;
		font-weight: 400;
		color: var(--text-dim);
	}

	.seats {
		font-size: 12px;
		color: var(--text-dim);
		margin-bottom: 16px;
	}

	.dim {
		color: var(--text-dim);
	}
</style>
