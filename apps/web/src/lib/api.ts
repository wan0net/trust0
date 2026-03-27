const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

// ── Request helper ─────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE}${path}`, {
		...init,
		credentials: "include",
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({ error: "Request failed" }));
		throw new Error((body as { error: string }).error || `HTTP ${response.status}`);
	}
	return response.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MeResponse {
	user: User;
}

// Alias for backward compat — pages import this type
export type { User as MeUser };

// ── Auth ───────────────────────────────────────────────────────────────────

export async function getMe(): Promise<MeResponse | null> {
	try {
		const data = await request<MeResponse>("/api/me");
		if (!data.user) return null;
		return data;
	} catch {
		return null;
	}
}

export async function signInWithGitHub(): Promise<void> {
	const callbackURL = typeof window !== "undefined"
		? `${window.location.origin}/identity`
		: "";

	const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ provider: "github", callbackURL }),
	});

	if (!res.ok) {
		throw new Error(`Sign-in failed: ${res.status}`);
	}

	const data = await res.json() as { url?: string; redirect?: boolean };
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
		// Clear local state regardless
	}
	window.location.href = "/";
}
