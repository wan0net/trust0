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
	image: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MeResponse {
	user: User;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function getMe(): Promise<MeResponse | null> {
	try {
		return await request<MeResponse>("/api/me");
	} catch {
		return null;
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
}
