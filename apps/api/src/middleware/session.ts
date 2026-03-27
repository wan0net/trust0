import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Context, Next } from "hono";
import { createAuth } from "../auth";
import type * as schema from "../db/schema";
import type { Env } from "../types";

// biome-ignore lint/suspicious/noExplicitAny: Better Auth session types
type SessionUser = Record<string, any> | null;
// biome-ignore lint/suspicious/noExplicitAny: Better Auth session types
type SessionData = Record<string, any> | null;

export type AuthEnv = Env & {
	Variables: {
		user: SessionUser;
		session: SessionData;
		db: DrizzleD1Database<typeof schema>;
	};
};

export async function sessionMiddleware(c: Context<AuthEnv>, next: Next) {
	const auth = createAuth(c.env);
	const result = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	c.set("user", result?.user ?? null);
	c.set("session", result?.session ?? null);
	await next();
}

export function requireAuth(c: Context<AuthEnv>, next: Next) {
	const user = c.get("user");
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	return next();
}
