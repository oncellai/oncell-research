// oncell-research — AI research agent with web search and streaming
// Runs inside an OnCell cell. Uses ctx.stream() for SSE streaming.

module.exports = {
  async research(ctx, params) {
    const { query, session_id } = params;
    if (!query) return { error: "query is required" };

    const sessionId = session_id || "default";
    const history = ctx.db.get(`session:${sessionId}`) || [];

    // 1. Search the web via Tavily
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return { error: "TAVILY_API_KEY not configured" };

    let sources = [];
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: query,
          search_depth: "advanced",
          max_results: 6,
          include_answer: false,
          include_raw_content: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        sources = (data.results || []).map((r, i) => ({
          index: i + 1,
          title: r.title,
          url: r.url,
          content: r.content,
        }));
      }
    } catch (err) {
      console.error("Tavily search failed:", err.message);
    }

    // 2. Build LLM messages
    const sourcesBlock = sources.length > 0
      ? sources.map((r) =>
          `[Source ${r.index}: ${r.title}]\nURL: ${r.url}\n${r.content}`
        ).join("\n\n---\n\n")
      : "No web results found. Answer from your own knowledge and clearly state that.";

    const messages = [
      {
        role: "system",
        content: `You are a research assistant. Answer the user's question using the provided web sources. Be thorough and well-structured.

Rules:
- Use information from the sources to build a comprehensive answer
- Do NOT include [Source N] citations inline — sources are shown separately in the UI
- Use markdown formatting: **bold**, bullet points, headers
- If sources don't cover the topic, say so and provide what you know
- Be concise but complete

## Web Sources

${sourcesBlock}`
      },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: query },
    ];

    // 3. Send sources immediately via ctx.stream()
    ctx.stream({ type: "sources", sources });

    // 4. Call LLM with streaming
    const model = process.env.LLM_MODEL || "google/gemini-2.5-flash";
    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2048, stream: true }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      return { error: `LLM failed: ${llmRes.status}`, details: err };
    }

    // 5. Stream LLM tokens via ctx.stream()
    const reader = llmRes.body.getReader();
    const decoder = new TextDecoder();
    let fullAnswer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullAnswer += content;
            ctx.stream({ type: "text", content });
          }
        } catch {}
      }
    }

    // 6. Save history
    history.push(
      { role: "user", content: query, ts: new Date().toISOString() },
      { role: "assistant", content: fullAnswer, ts: new Date().toISOString() },
    );
    ctx.db.set(`session:${sessionId}`, history.slice(-20));
    ctx.search.index(`research:${Date.now()}`, `Q: ${query}\n\nA: ${fullAnswer}`);

    return { type: "done" };
  },

  async get_history(ctx, params) {
    return { messages: ctx.db.get(`session:${params.session_id}`) || [] };
  },

  async clear_history(ctx, params) {
    ctx.db.delete(`session:${params.session_id}`);
    return { cleared: true };
  },
};
