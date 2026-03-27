export type Env = {
	Bindings: {
		DB: D1Database;
		AUTH_SECRET: string;
		AUTH_URL: string;
		ALLOWED_ORIGINS: string;
		GITHUB_CLIENT_ID: string;
		GITHUB_CLIENT_SECRET: string;
		RESEND_API_KEY: string;
		EMAIL_FROM: string;
		BOT_API_KEY: string;
		ASPE_DOMAIN: string;
	};
};
