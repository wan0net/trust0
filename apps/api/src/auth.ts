import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import type { Env } from "./types";

export function createAuth(env: Env["Bindings"]) {
	const db = drizzle(env.DB, { schema });

	return betterAuth({
		database: { db, type: "sqlite" },
		secret: env.AUTH_SECRET,
		baseURL: env.AUTH_URL,
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			},
		},
		trustedOrigins: env.ALLOWED_ORIGINS
			? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
			: [],
	});
}
