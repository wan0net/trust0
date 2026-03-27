export const load = async ({ cookies }) => {
	return {
		theme: cookies.get("theme") || "light",
	};
};
