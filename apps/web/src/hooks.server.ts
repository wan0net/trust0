import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
	const theme = event.cookies.get("theme") || "light";

	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(
				'<html lang="en">',
				`<html lang="en" data-theme="${theme}">`,
			),
	});

	return response;
};
