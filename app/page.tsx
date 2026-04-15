"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Source {
  index: number;
  title: string;
  url: string;
  content: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function Research() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("oncell_research_session");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("oncell_research_session", id);
    }
    return id;
  });

  const scrollToBottom = useCallback(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, session_id: sessionId }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function newSession() {
    setMessages([]);
    setInput("");
    const id = crypto.randomUUID();
    localStorage.setItem("oncell_research_session", id);
  }

  function renderMarkdown(text: string) {
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
        `<pre style="background:rgba(255,255,255,0.04);padding:12px 14px;border-radius:8px;margin:8px 0;font-size:12px;overflow-x:auto;border:1px solid var(--border)"><code>${code.trim()}</code></pre>`
      )
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)/gm, '<h3 style="font-size:14px;font-weight:600;margin:16px 0 6px;color:var(--text)">$1</h3>')
      .replace(/^## (.+)/gm, '<h2 style="font-size:15px;font-weight:600;margin:18px 0 8px;color:var(--text)">$1</h2>')
      .replace(/^- (.+)/gm, '<div style="padding-left:14px;margin:2px 0">&bull; $1</div>')
      .replace(/^\d+\. (.+)/gm, (_m, text, _o, _s) => `<div style="padding-left:14px;margin:2px 0">${text}</div>`)
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  function getDomain(url: string) {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  }

  function getFavicon(url: string) {
    try { return `https://www.google.com/s2/favicons?sz=16&domain=${new URL(url).hostname}`; } catch { return ""; }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
          >
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="24" height="24" rx="6" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
              <circle cx="16" cy="16" r="3.5" fill="var(--accent)"/>
            </svg>
          </div>
          <span className="font-medium text-[15px]">Research</span>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={newSession}
              className="text-[12px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-dim)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          )}
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Powered by{" "}
            <a href="https://oncell.ai" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }} className="hover:opacity-60 transition-colors">
              oncell
            </a>
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h1 className="text-2xl font-medium mb-2">Research anything</h1>
              <p className="text-[14px] max-w-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Ask a question. I&apos;ll search the web and give you a synthesized answer with sources.
              </p>

              <div className="flex flex-col gap-2 mt-8 w-full max-w-md">
                {[
                  "What are the best practices for RAG architectures?",
                  "Compare Rust vs Go for building APIs",
                  "How does gVisor provide container isolation?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-[13px] text-left px-4 py-3 rounded-xl transition-all"
                    style={{ color: "var(--text-dim)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.color = "var(--text)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="mb-8 animate-slide-up" style={{ animationDelay: `${Math.min(i, 2) * 40}ms` }}>
              {msg.role === "user" ? (
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <p className="text-[16px] font-medium pt-0.5">{msg.content}</p>
                </div>
              ) : (
                <div>
                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[11px] font-medium uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Sources</div>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {msg.sources.map((s) => (
                          <a
                            key={s.index}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 w-[200px] rounded-xl p-3 transition-all hover:opacity-80"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <img src={getFavicon(s.url)} alt="" width="12" height="12" className="rounded-sm" />
                              <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{getDomain(s.url)}</span>
                            </div>
                            <p className="text-[12px] leading-snug line-clamp-2" style={{ color: "var(--text-dim)" }}>{s.title}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Answer */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                      <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
                        <rect x="4" y="4" width="24" height="24" rx="6" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
                        <circle cx="16" cy="16" r="3.5" fill="var(--accent)"/>
                      </svg>
                    </div>
                    <div
                      className="text-[14px] leading-[1.8] flex-1"
                      style={{ color: "var(--text)" }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading state */}
          {loading && (
            <div className="mb-8 animate-fade-in">
              <div className="mb-4">
                <div className="text-[11px] font-medium uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Searching the web...</div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="shimmer shrink-0 w-[200px] h-[72px] rounded-xl" />
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}>
                  <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
                    <rect x="4" y="4" width="24" height="24" rx="6" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
                    <circle cx="16" cy="16" r="3.5" fill="var(--accent)"/>
                  </svg>
                </div>
                <div className="flex gap-1.5 pt-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-typing" style={{ background: "var(--accent)" }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-typing-2" style={{ background: "var(--accent)" }} />
                  <div className="w-1.5 h-1.5 rounded-full animate-typing-3" style={{ background: "var(--accent)" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            autoComplete="off"
            className="w-full rounded-xl pl-4 pr-12 py-3.5 text-[14px] transition-all focus:outline-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text)" }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent-border)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-15"
            style={{ background: "var(--accent)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
