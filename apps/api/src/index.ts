import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { aspeRoutes } from "./aspe";
import { createAuth } from "./auth";
import * as schema from "./db/schema";
import { sigchainRoutes } from "./sigchain";
import { exportRoutes } from "./export";
import type { AuthEnv } from "./middleware/session";

const app = new Hono<AuthEnv>();

// ── DB middleware ────────────────────────────────────────────────────────────

app.use("*", async (c, next) => {
	const db = drizzle(c.env.DB, { schema });
	c.set("db", db);
	await next();
});

// ── CORS ────────────────────────────────────────────────────────────────────

app.use("/api/*", async (c, next) => {
	const origins = c.env.ALLOWED_ORIGINS
		? c.env.ALLOWED_ORIGINS.split(",").map((o: string) => o.trim())
		: [];

	return cors({
		origin: origins,
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
		credentials: true,
		maxAge: 600,
	})(c, next);
});

// ── Auth (Better Auth — GitHub OAuth only) ──────────────────────────────────

app.on(["GET", "POST"], "/api/auth/**", (c) => {
	const auth = createAuth(c.env);
	return auth.handler(c.req.raw);
});

// ── Current user ────────────────────────────────────────────────────────────

app.get("/api/me", async (c) => {
	const auth = createAuth(c.env);
	const result = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!result?.user) {
		return c.json({ user: null });
	}
	return c.json({ user: result.user });
});

// ── Identity routes ─────────────────────────────────────────────────────────

app.route("/", aspeRoutes);
app.route("/", sigchainRoutes);
app.route("/", exportRoutes);

// ── Health ──────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok" }));

// ── Config (public) ─────────────────────────────────────────────────────────

app.get("/api/config", (c) => {
	return c.json({
		aspeDomain: c.env.ASPE_DOMAIN || "trust0.app",
	});
});

export default app;
