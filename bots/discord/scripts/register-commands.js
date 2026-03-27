// Run with: LOGIN2_DISCORD_APP_ID=... LOGIN2_DISCORD_BOT_TOKEN=... node scripts/register-commands.js

const APP_ID = process.env.LOGIN2_DISCORD_APP_ID;
const BOT_TOKEN = process.env.LOGIN2_DISCORD_BOT_TOKEN;

const command = {
	name: "verify",
	description: "Link your Discord account to your cryptographic identity",
	type: 1, // CHAT_INPUT
	options: [
		{
			name: "fingerprint",
			description:
				"Your 26-character identity fingerprint (shown on your identity dashboard)",
			type: 3, // STRING
			required: true,
		},
	],
};

async function main() {
	const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bot ${BOT_TOKEN}`,
		},
		body: JSON.stringify(command),
	});

	if (res.ok) {
		console.log("Command registered:", await res.json());
	} else {
		console.error("Failed:", res.status, await res.text());
	}
}

main();
