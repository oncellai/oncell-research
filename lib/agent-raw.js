// oncell-research — AI research agent with web search and streaming
// Runs inside an OnCell cell. Uses ctx.stream() for SSE streaming.

module.exports = {
  async setup(ctx) {
    if (!ctx.store.exists("index.html")) {
      ctx.store.write("index.html", PLAYGROUND_HTML("Research Agent", "research", "query"));
    }
  },

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

function PLAYGROUND_HTML(title, method, inputField) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — OnCell Playground</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e8e4de;min-height:100vh;display:flex;flex-direction:column}
header{padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px}
header span{font-size:14px;font-weight:500}
header small{font-size:11px;color:rgba(232,228,222,0.3)}
#messages{flex:1;overflow-y:auto;padding:24px;max-width:700px;margin:0 auto;width:100%}
.msg{margin-bottom:16px;animation:fadeIn .3s}
.msg.user{text-align:right}
.msg .bubble{display:inline-block;max-width:80%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.6;text-align:left;white-space:pre-wrap}
.msg.user .bubble{background:rgba(212,165,74,0.9);color:#0a0a0a;border-bottom-right-radius:4px}
.msg.assistant .bubble{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-bottom-left-radius:4px}
form{padding:16px 24px;border-top:1px solid rgba(255,255,255,0.06);max-width:700px;margin:0 auto;width:100%;display:flex;gap:8px}
input{flex:1;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:#e8e4de;font-size:14px;outline:none}
input:focus{border-color:rgba(212,165,74,0.4)}
button{padding:12px 20px;border-radius:10px;border:none;background:#d4a54a;color:#0a0a0a;font-size:14px;font-weight:500;cursor:pointer}
button:disabled{opacity:0.3}
.typing span{display:inline-block;width:6px;height:6px;background:rgba(212,165,74,0.5);border-radius:50%;margin:0 2px;animation:blink 1.4s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
</style></head>
<body>
<header>
<svg width="16" height="16" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="6" stroke="#d4a54a" stroke-width="1.5" fill="none"/><circle cx="16" cy="16" r="3.5" fill="#d4a54a"/></svg>
<span>${title}</span>
<small>Playground</small>
</header>
<div id="messages"></div>
<form id="f">
<input id="q" placeholder="Type a message..." autocomplete="off">
<button type="submit" id="btn">Send</button>
</form>
<script>
var cid=localStorage.getItem("pg_cid")||crypto.randomUUID();localStorage.setItem("pg_cid",cid);
var msgs=document.getElementById("messages"),form=document.getElementById("f"),input=document.getElementById("q"),btn=document.getElementById("btn");
function add(role,text){var d=document.createElement("div");d.className="msg "+role;d.innerHTML='<div class="bubble">'+text.replace(/</g,"&lt;").replace(/\\*\\*(.+?)\\*\\*/g,"<b>$1</b>").replace(/\\n/g,"<br>")+"</div>";msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
function showTyping(){var d=document.createElement("div");d.className="msg assistant";d.id="typing";d.innerHTML='<div class="bubble typing"><span></span><span></span><span></span></div>';msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
form.onsubmit=async function(e){e.preventDefault();var q=input.value.trim();if(!q)return;input.value="";btn.disabled=true;
add("user",q);showTyping();
try{var res=await fetch("/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({method:"${method}",params:{${inputField}:q,customer_id:cid,session_id:cid}})});
var ct=res.headers.get("content-type")||"";
if(ct.includes("text/event-stream")&&res.body){
var el=document.getElementById("typing");if(el)el.remove();
var bubble=add("assistant","");var txt="";
var reader=res.body.getReader(),dec=new TextDecoder();
while(true){var r=await reader.read();if(r.done)break;
var chunk=dec.decode(r.value,{stream:true});
chunk.split("\\n").forEach(function(line){if(!line.startsWith("data: "))return;
try{var d=JSON.parse(line.slice(6));
if(d.type==="text")txt+=d.content;
}catch(e){}});
bubble.querySelector(".bubble").innerHTML=txt.replace(/</g,"&lt;").replace(/\\*\\*(.+?)\\*\\*/g,"<b>$1</b>").replace(/\\n/g,"<br>");
msgs.scrollTop=msgs.scrollHeight;}
}else{
var data=await res.json();var el=document.getElementById("typing");if(el)el.remove();
add("assistant",data.reply||data.answer||data.error||JSON.stringify(data));}
}catch(err){var el=document.getElementById("typing");if(el)el.remove();add("assistant","Error: "+err.message);}
btn.disabled=false;input.focus();};
</script></body></html>`;
}
