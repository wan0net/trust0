import { Hono } from "hono";
import { cors } from "hono/cors";

// ── Types ────────────────────────────────────────────────────────────────────

type Env = {
	Bindings: {
		ALLOWED_ORIGINS: string;
	};
};

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RESPONSE_SIZE = 1_048_576; // 1 MB
const FETCH_TIMEOUT_MS = 10_000;

/** RFC 1918 / loopback / link-local prefixes that must never be proxied to. */
const PRIVATE_HOST_PATTERNS = [
	/^localhost$/i,
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^0\./,
	/^\[::1\]/,
	/^\[fc/i,
	/^\[fd/i,
	/^\[fe80:/i,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const isPrivateHost = (hostname: string): boolean =>
	PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname));

const requireHttps = (url: string): URL => {
	const parsed = new URL(url);
	if (parsed.protocol !== "https:") {
		throw new Error("Only HTTPS URLs are allowed");
	}
	if (isPrivateHost(parsed.hostname)) {
		throw new Error("Requests to private/internal hosts are not allowed");
	}
	return parsed;
};

const fetchWithTimeout = async (
	input: RequestInfo,
	init?: RequestInit,
): Promise<Response> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const res = await fetch(input, {
			...init,
			signal: controller.signal,
		});
		return res;
	} finally {
		clearTimeout(timer);
	}
};

const enforceSize = async (res: Response): Promise<string> => {
	const contentLength = res.headers.get("content-length");
	if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
		throw new Error("Response too large");
	}

	const body = await res.text();
	if (body.length > MAX_RESPONSE_SIZE) {
		throw new Error("Response too large");
	}
	return body;
};

// ── App ──────────────────────────────────────────────────────────────────────

const app = new Hono<Env>();

// ── CORS middleware ──────────────────────────────────────────────────────────

app.use("*", async (c, next) => {
	const origins = c.env.ALLOWED_ORIGINS
		? c.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
		: [];

	const corsMiddleware = cors({
		origin: origins,
		allowMethods: ["GET", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	});

	return corsMiddleware(c, next);
});

// Note: Real rate limiting should be configured at the Cloudflare level
// (Rate Limiting Rules or Workers Rate Limiting API). No fake headers.

// ── GET /api/3/get/http ──────────────────────────────────────────────────────

app.get("/api/3/get/http", async (c) => {
	const url = c.req.query("url");
	if (!url) {
		return c.json({ error: "Missing 'url' parameter" }, 400);
	}

	try {
		const parsed = requireHttps(url);

		const res = await fetchWithTimeout(parsed.toString(), {
			headers: {
				"User-Agent": "identity-proxy/0.1",
			},
		});

		if (!res.ok) {
			return c.json(
				{ error: `Upstream returned ${res.status}` },
				res.status as any,
			);
		}

		const body = await enforceSize(res);
		const contentType = res.headers.get("content-type") || "text/plain";

		// doipjs consumes the proxy response via fetcher.http which expects
		// either parsed JSON or raw text depending on the proof format.
		// Return the body as-is with the original content-type so axios
		// in doipjs can parse it correctly.
		return new Response(body, {
			headers: {
				"Content-Type": contentType,
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return c.json({ error: message }, 400);
	}
});

// ── GET /api/3/get/dns ───────────────────────────────────────────────────────

app.get("/api/3/get/dns", async (c) => {
	const domain = c.req.query("domain");
	if (!domain) {
		return c.json({ error: "Missing 'domain' parameter" }, 400);
	}

	// Domain validation — alphanumeric, hyphens, dots, max 253 chars (RFC 1035)
	if (domain.length > 253 || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
		return c.json({ error: "Invalid domain" }, 400);
	}

	try {
		const res = await fetchWithTimeout(
			`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`,
			{
				headers: {
					Accept: "application/dns-json",
				},
			},
		);

		if (!res.ok) {
			return c.json({ error: `DNS query failed: ${res.status}` }, 502);
		}

		const dnsData = (await res.json()) as {
			Answer?: Array<{ data: string }>;
		};

		// Transform to the format doipjs dns fetcher returns:
		// { domain, records: { txt: [["record1"], ["record2"]] } }
		// dns.resolveTxt returns an array of arrays (each TXT record can have
		// multiple strings that get concatenated).
		const txtRecords: string[][] = (dnsData.Answer || [])
			.filter((a: any) => a.type === 16) // TXT record type
			.map((a: any) => {
				// DNS-over-HTTPS returns TXT data with quotes — strip them
				const cleaned = (a.data as string).replace(/^"|"$/g, "");
				return [cleaned];
			});

		return c.json({
			domain,
			records: {
				txt: txtRecords,
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return c.json({ error: message }, 400);
	}
});

// ── GET /api/3/get/activitypub ───────────────────────────────────────────────

app.get("/api/3/get/activitypub", async (c) => {
	const url = c.req.query("url");
	if (!url) {
		return c.json({ error: "Missing 'url' parameter" }, 400);
	}

	try {
		const parsed = requireHttps(url);

		const res = await fetchWithTimeout(parsed.toString(), {
			headers: {
				Accept: "application/activity+json",
				"User-Agent": "identity-proxy/0.1",
			},
		});

		if (!res.ok) {
			return c.json(
				{ error: `Upstream returned ${res.status}` },
				res.status as any,
			);
		}

		const body = await enforceSize(res);

		return new Response(body, {
			headers: {
				"Content-Type": "application/activity+json",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return c.json({ error: message }, 400);
	}
});

// ── GET /api/3/get/graphql ───────────────────────────────────────────────────

app.get("/api/3/get/graphql", async (c) => {
	const url = c.req.query("url");
	const query = c.req.query("query");

	if (!url) {
		return c.json({ error: "Missing 'url' parameter" }, 400);
	}
	if (!query) {
		return c.json({ error: "Missing 'query' parameter" }, 400);
	}

	try {
		const parsed = requireHttps(url);

		let jsonData: unknown;
		try {
			jsonData = JSON.parse(decodeURIComponent(query));
		} catch {
			return c.json({ error: "Invalid GraphQL query object" }, 400);
		}

		const res = await fetchWithTimeout(parsed.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "identity-proxy/0.1",
			},
			body: JSON.stringify(jsonData),
		});

		if (!res.ok) {
			return c.json(
				{ error: `Upstream returned ${res.status}` },
				res.status as any,
			);
		}

		const body = await enforceSize(res);

		return new Response(body, {
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return c.json({ error: message }, 400);
	}
});

// ── GET /api/3/get/aspe ──────────────────────────────────────────────────────

app.get("/api/3/get/aspe", async (c) => {
	const aspeUri = c.req.query("aspeUri");
	if (!aspeUri) {
		return c.json({ error: "Missing 'aspeUri' parameter" }, 400);
	}

	// ASPE URI format: aspe:domain.example:fingerprint
	const match = aspeUri.match(/^aspe:([a-zA-Z0-9.\-_]+):([a-zA-Z0-9]+)/);
	if (!match) {
		return c.json({ error: "Invalid ASPE URI" }, 400);
	}

	const [, domain, fingerprint] = match;
	const url = `https://${domain}/.well-known/aspe/id/${fingerprint.toUpperCase()}`;

	try {
		const res = await fetchWithTimeout(url, {
			headers: {
				Accept: "application/asp+jwt",
				"User-Agent": "identity-proxy/0.1",
			},
		});

		if (!res.ok) {
			return c.json(
				{ error: `Upstream returned ${res.status}` },
				res.status as any,
			);
		}

		const body = await enforceSize(res);

		return new Response(body, {
			headers: {
				"Content-Type": res.headers.get("content-type") || "application/asp+jwt",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return c.json({ error: message }, 400);
	}
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
