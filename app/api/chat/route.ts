import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, session_id } = await req.json();
    if (!query) return Response.json({ error: "query is required" }, { status: 400 });

    const apiKey = process.env.ONCELL_API_KEY;
    const cellId = process.env.ONCELL_CELL_ID;
    const baseUrl = process.env.ONCELL_API_URL || "https://api.oncell.ai";

    if (!apiKey || !cellId) {
      return Response.json({ error: "ONCELL_API_KEY and ONCELL_CELL_ID required" }, { status: 500 });
    }

    // Call cell — the agent returns an SSE stream
    const res = await fetch(`${baseUrl}/api/v1/cells/${encodeURIComponent(cellId)}/request`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method: "research", params: { query, session_id: session_id || "default" } }),
    });

    if (!res.ok && !res.headers.get("content-type")?.includes("text/event-stream")) {
      const body = await res.json().catch(() => ({}));
      return Response.json({ error: (body as any).error || "Cell request failed" }, { status: res.status });
    }

    // Pipe the SSE stream from the cell to the browser
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("research error:", err.message);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
