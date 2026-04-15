// oncell-research — AI research agent with web search and citations
// Runs inside an OnCell cell. Uses ctx.db for history, ctx.fetch for web search.

module.exports = {
  async research(ctx, params) {
    const { query, session_id } = params;
    if (!query) return { error: "query is required" };

    const sessionId = session_id || "default";

    // 1. Load conversation history
    const history = ctx.db.get(`session:${sessionId}`) || [];

    // 2. Search the web via Tavily
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return { error: "TAVILY_API_KEY not configured" };

    let searchResults = [];
    try {
      const searchRes = await fetch("https://api.tavily.com/search", {
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

      if (searchRes.ok) {
        const data = await searchRes.json();
        searchResults = (data.results || []).map((r, i) => ({
          index: i + 1,
          title: r.title,
          url: r.url,
          content: r.content,
        }));
      }
    } catch (err) {
      console.error("Tavily search failed:", err.message);
    }

    // 3. Build sources block for the LLM
    const sourcesBlock = searchResults.length > 0
      ? searchResults.map((r) =>
          `[Source ${r.index}: ${r.title}]\nURL: ${r.url}\n${r.content}`
        ).join("\n\n---\n\n")
      : "No web results found. Answer from your own knowledge and clearly state that.";

    // 4. Build LLM messages
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

    // 5. Call LLM
    const model = process.env.LLM_MODEL || "google/gemini-2.5-flash";
    const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2048 }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      return { error: `LLM call failed: ${llmRes.status}`, details: err };
    }

    const llmData = await llmRes.json();
    const answer = llmData.choices[0].message.content;

    // 6. Save conversation history (keep last 20)
    history.push(
      { role: "user", content: query, ts: new Date().toISOString() },
      { role: "assistant", content: answer, ts: new Date().toISOString() },
    );
    ctx.db.set(`session:${sessionId}`, history.slice(-20));

    // 7. Save this research to searchable index for future reference
    ctx.search.index(`research:${Date.now()}`, `Q: ${query}\n\nA: ${answer}`);

    return {
      answer,
      sources: searchResults,
      query,
    };
  },

  async get_history(ctx, params) {
    return { messages: ctx.db.get(`session:${params.session_id}`) || [] };
  },

  async clear_history(ctx, params) {
    ctx.db.delete(`session:${params.session_id}`);
    return { cleared: true };
  },

  async search_past(ctx, params) {
    const results = ctx.search.query(params.query, 5);
    return { results };
  },
};
