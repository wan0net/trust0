import {
	InteractionType,
	InteractionResponseType,
	verifyKey,
} from "discord-interactions";

interface Env {
	DISCORD_PUBLIC_KEY: string;
	DISCORD_APP_ID: string;
	DISCORD_BOT_TOKEN: string;
	BOT_API_KEY: string;
	LOGIN2_API_URL: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		// Verify Discord signature
		const signature = request.headers.get("X-Signature-Ed25519");
		const timestamp = request.headers.get("X-Signature-Timestamp");
		const body = await request.text();

		if (!signature || !timestamp) {
			return new Response("Bad request", { status: 401 });
		}

		const isValid = await verifyKey(
			body,
			signature,
			timestamp,
			env.DISCORD_PUBLIC_KEY
		);
		if (!isValid) {
			return new Response("Invalid signature", { status: 401 });
		}

		const interaction = JSON.parse(body);

		// Handle PING (required for Discord endpoint verification)
		if (interaction.type === InteractionType.PING) {
			return Response.json({ type: InteractionResponseType.PONG });
		}

		// Handle slash command: /verify
		if (interaction.type === InteractionType.APPLICATION_COMMAND) {
			if (interaction.data.name === "verify") {
				const fingerprint = interaction.data.options?.[0]?.value;

				if (!fingerprint || !/^[A-Z2-7]{26}$/.test(fingerprint)) {
					return Response.json({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							content:
								"Invalid fingerprint. Must be a 26-character BASE32 string (uppercase A-Z, 2-7).",
							flags: 64,
						},
					});
				}

				const userId =
					interaction.member?.user?.id || interaction.user?.id;
				const username =
					interaction.member?.user?.username ||
					interaction.user?.username;
				const discriminator =
					interaction.member?.user?.discriminator ||
					interaction.user?.discriminator;
				const displayName =
					discriminator && discriminator !== "0"
						? `${username}#${discriminator}`
						: username;

				// Call login2 attestation API
				try {
					const res = await fetch(
						`${env.LOGIN2_API_URL}/api/identity/attest-bot`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								fingerprint,
								platform: "discord",
								platformUserId: userId,
								platformUsername: displayName,
								apiKey: env.BOT_API_KEY,
							}),
						}
					);

					if (res.ok) {
						return Response.json({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: `Verified! Your Discord account (${displayName}) is now linked to identity \`${fingerprint}\`.\n\nView your profile: ${env.LOGIN2_API_URL.replace("/api", "")}/identity/profile/${fingerprint}`,
								flags: 64,
							},
						});
					} else {
						const err = await res
							.json()
							.catch(() => ({ error: "Unknown error" }));
						return Response.json({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: `Verification failed: ${(err as { error: string }).error}`,
								flags: 64,
							},
						});
					}
				} catch {
					return Response.json({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							content:
								"Verification service temporarily unavailable. Try again later.",
							flags: 64,
						},
					});
				}
			}
		}

		return Response.json({ type: InteractionResponseType.PONG });
	},
};
