export default {
	async fetch(request, env) {

		// --- CORS Preflight ---
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type"
				}
			});
		}

		const url = new URL(request.url);

		// Health
		if (url.pathname === "/api/health") {
			return json({ status: "ok" });
		}

		// Get Books
		if (url.pathname === "/api/books" && request.method === "GET") {
			const { results } = await env.bookapp_db
				.prepare("SELECT * FROM books ORDER BY created_at DESC")
				.all();

			return json(results);
		}

		return new Response("Not Found", { status: 404 });
	}
};

// helper
function json(data) {
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*"
		}
	});
}
