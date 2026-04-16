# Build an AI Research Agent — Without Touching Infra

Search the web, synthesize answers, cite sources. Like Perplexity — but open source, and the entire backend is one file.

Built with [Next.js](https://nextjs.org) and [OnCell](https://oncell.ai).

[![Demo](https://img.youtube.com/vi/jvTVA7J925Y/maxresdefault.jpg)](https://youtu.be/jvTVA7J925Y)

**[Watch the demo (5 min)](https://youtu.be/jvTVA7J925Y)**

## What it does

- **Web search** — searches the internet for every query via Tavily
- **Synthesized answers** — LLM reads the sources and writes a structured response
- **Source cards** — every answer shows the web pages it came from, with favicons and links
- **Follow-up questions** — conversation context is maintained per session
- **Past research** — all queries are indexed and searchable for future reference
- **Zero infra** — search history, conversation memory, and agent runtime are all handled by OnCell

## How OnCell makes this possible

A research agent needs a runtime, a database for conversation history, and a search index for past research. That's three services.

OnCell gives you all of that in one call:

```javascript
const cell = await oncell.cells.create({
  customerId: "research",
  agent: agentCode,
});
// cell.db      → conversation history per session
// cell.search  → index and search past research
// cell.fetch   → web search via Tavily
// One file. Zero config.
```

## Quick start

```bash
git clone https://github.com/oncellai/oncell-research.git
cd oncell-research
npm install
```

### 1. Get your keys

- **OnCell** — [oncell.ai](https://oncell.ai)
- **OpenRouter** — [openrouter.ai](https://openrouter.ai)
- **Tavily** — [tavily.com](https://tavily.com) (free tier: 1000 searches/month)

Add them to `.env.local`:

```bash
cp .env.example .env.local
# Edit with your keys
```

### 2. Setup + run

```bash
node scripts/setup.js
npm run dev
```

Open http://localhost:3000 and start researching.

## Architecture

```
Next.js
├── /           Research UI (Perplexity-style)
├── /api/chat   POST → OnCell cell

OnCell cell
├── db          Session history per user
├── search      Index of past research
└── agent       Web search → LLM synthesis → cited answer
```

The agent code is one file: `lib/agent-raw.js`. It searches the web via Tavily, builds a prompt with the results, calls the LLM, saves history, and indexes the research for future reference.

## Customization

**Change the LLM** — set `LLM_MODEL` in `.env.local` (default: `google/gemini-2.5-flash`)

**Change search depth** — edit `search_depth` and `max_results` in `lib/agent-raw.js`

**Style the UI** — edit `app/page.tsx`. Standard Next.js + Tailwind.

## Learn more

- [OnCell](https://oncell.ai) — build AI agents without building infra
- [oncell-support-agent](https://github.com/oncellai/oncell-support-agent) — another open source OnCell project

## License

Apache-2.0
