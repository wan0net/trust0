// Run with: TELEGRAM_BOT_TOKEN=... WEBHOOK_URL=... WEBHOOK_SECRET=... node scripts/set-webhook.js

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SECRET = process.env.WEBHOOK_SECRET;

async function main() {
	const url = `https://api.telegram.org/bot${TOKEN}/setWebhook`;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			url: `${WEBHOOK_URL}?secret=${SECRET}`,
			allowed_updates: ["message"],
		}),
	});

	if (res.ok) {
		console.log("Webhook set:", await res.json());
	} else {
		console.error("Failed:", res.status, await res.text());
	}
}

main();
