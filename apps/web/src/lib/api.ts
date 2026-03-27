const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE}${path}`, {
		...init,
		credentials: "include",
	});
	if (!response.ok) {
		const body = await response
			.json()
			.catch(() => ({ error: "Request failed" }));
		throw new Error(
			(body as { error: string }).error || `HTTP ${response.status}`,
		);
	}
	return response.json() as Promise<T>;
}

export interface User {
	id: string;
	name: string;
	email: string;
	image: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Organization {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	exempt: boolean;
	createdAt: string;
	members?: Member[];
}

export interface Member {
	id: string;
	userId: string;
	role: string;
	user?: User;
}

export interface MeResponse {
	user: User;
	organization?: Organization;
}

export async function getMe(): Promise<MeResponse | null> {
	try {
		return await request<MeResponse>("/api/me");
	} catch {
		return null;
	}
}

export async function checkDevMode(): Promise<boolean> {
	try {
		const data = await request<{ devMode: boolean }>("/api/dev/status");
		return data.devMode;
	} catch {
		return false;
	}
}

export async function devLogin(): Promise<MeResponse | null> {
	try {
		return await request<MeResponse>("/api/dev/login", { method: "POST" });
	} catch {
		return null;
	}
}

export async function devLogout(): Promise<void> {
	await fetch(`${API_BASE}/api/dev/logout`, {
		method: "POST",
		credentials: "include",
	});
}

// ── Subscriptions ──────────────────────────────────────────────────────────

export interface Subscription {
	id: string;
	plan: string;
	referenceId: string;
	status: string;
	seats: number | null;
	periodStart: string | null;
	periodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	billingInterval: string | null;
}

export interface Plan {
	name: string;
	label: string;
	seats: number;
	price: number;
}

export async function getPlans(): Promise<Plan[]> {
	try {
		return await request<Plan[]>("/api/plans");
	} catch {
		return [];
	}
}

export async function listSubscriptions(
	referenceId?: string,
): Promise<Subscription[]> {
	try {
		const query = referenceId ? `?referenceId=${referenceId}` : "";
		return await request<Subscription[]>(`/api/auth/subscription/list${query}`);
	} catch {
		return [];
	}
}

export async function upgradeSubscription(data: {
	plan: string;
	referenceId?: string;
	seats?: number;
}): Promise<Subscription | null> {
	try {
		return await request<Subscription>("/api/auth/subscription/upgrade", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
	} catch {
		return null;
	}
}

export async function cancelSubscription(
	referenceId?: string,
): Promise<Subscription | null> {
	try {
		return await request<Subscription>("/api/auth/subscription/cancel", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ referenceId }),
		});
	} catch {
		return null;
	}
}

export async function signInWithProvider(provider: string): Promise<void> {
	const callbackURL =
		typeof window !== "undefined" ? `${window.location.origin}/admin` : "";
	const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ provider, callbackURL }),
	});
	if (!res.ok) {
		throw new Error(`Sign-in failed: ${res.status}`);
	}
	const data = (await res.json()) as { url: string; redirect?: boolean };
	if (data.url) {
		window.location.href = data.url;
	}
}

export async function signOut(): Promise<void> {
	try {
		await fetch(`${API_BASE}/api/auth/sign-out`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
	} catch {
		// Ignore errors — clear local state regardless
	}
}
