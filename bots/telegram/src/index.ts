interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_WEBHOOK_SECRET: string;
	BOT_API_KEY: string;
	LOGIN2_API_URL: string;
}

interface TelegramUpdate {
	message?: {
		message_id: number;
		from: {
			id: number;
			username?: string;
			first_name: string;
			last_name?: string;
		};
		chat: { id: number; type: string };
		text?: string;
	};
}

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
	await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("OK", { status: 200 });
		}

		// Verify webhook secret
		const secret = new URL(request.url).searchParams.get("secret");
		if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
			return new Response("Unauthorized", { status: 401 });
		}

		const update: TelegramUpdate = await request.json();
		const message = update.message;

		if (!message?.text || !message.from) {
			return new Response("OK", { status: 200 });
		}

		const chatId = message.chat.id;

		// Handle /start command
		if (message.text === "/start") {
			await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
				"Welcome to the Identity Verification Bot!\n\n" +
				"To link your Telegram account to your cryptographic identity, send:\n" +
				"`/verify YOUR_FINGERPRINT`\n\n" +
				"Your fingerprint is the 26-character code shown on your identity dashboard."
			);
			return new Response("OK", { status: 200 });
		}

		// Handle /verify command
		if (message.text.startsWith("/verify")) {
			const parts = message.text.split(/\s+/);
			const fingerprint = parts[1];

			if (!fingerprint || !/^[A-Z2-7]{26}$/.test(fingerprint)) {
				await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
					"Invalid fingerprint. Must be a 26-character BASE32 string (uppercase A-Z, 2-7).\n\n" +
					"Usage: `/verify ABCDEFGHIJKLMNOPQRSTUVWXYZ`"
				);
				return new Response("OK", { status: 200 });
			}

			const userId = String(message.from.id);
			const username = message.from.username
				? `@${message.from.username}`
				: `${message.from.first_name}${message.from.last_name ? " " + message.from.last_name : ""}`;

			try {
				const res = await fetch(`${env.LOGIN2_API_URL}/api/identity/attest-bot`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						fingerprint,
						platform: "telegram",
						platformUserId: userId,
						platformUsername: username,
						apiKey: env.BOT_API_KEY,
					}),
				});

				if (res.ok) {
					await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
						`Verified! Your Telegram account (${username}) is now linked to identity \`${fingerprint}\`.`
					);
				} else {
					const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
					await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
						`Verification failed: ${err.error}`
					);
				}
			} catch {
				await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
					"Verification service temporarily unavailable. Try again later."
				);
			}

			return new Response("OK", { status: 200 });
		}

		// Unknown command
		await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId,
			"Unknown command. Send `/verify YOUR_FINGERPRINT` to link your Telegram account."
		);

		return new Response("OK", { status: 200 });
	},
};
