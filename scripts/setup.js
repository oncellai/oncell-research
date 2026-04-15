// Setup script — creates an OnCell cell with the research agent code.
// Reads keys from .env.local or environment variables.

import { OnCell } from "@oncell/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";

// Load .env.local if it exists
const envPath = new URL("../.env.local", import.meta.url).pathname;
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^(\w+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

async function main() {
  if (!process.env.ONCELL_API_KEY) { console.error("Set ONCELL_API_KEY in .env.local"); process.exit(1); }
  if (!process.env.OPENROUTER_API_KEY) { console.error("Set OPENROUTER_API_KEY in .env.local"); process.exit(1); }
  if (!process.env.TAVILY_API_KEY) { console.error("Set TAVILY_API_KEY in .env.local (get one at tavily.com)"); process.exit(1); }

  const oncell = new OnCell({ apiKey: process.env.ONCELL_API_KEY });
  const agentCode = readFileSync(new URL("../lib/agent-raw.js", import.meta.url), "utf-8");

  console.log("Creating cell...");
  const cell = await oncell.cells.create({
    customerId: `research-${Date.now()}`,
    tier: "starter",
    permanent: true,
    secrets: {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      LLM_MODEL: process.env.LLM_MODEL || "google/gemini-2.5-flash",
    },
    agent: agentCode,
  });
  console.log(`Cell: ${cell.id}`);

  // Auto-write cell ID to .env.local
  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
  if (envContent.includes("ONCELL_CELL_ID=")) {
    envContent = envContent.replace(/ONCELL_CELL_ID=.*/, `ONCELL_CELL_ID=${cell.id}`);
  } else {
    envContent = envContent.trimEnd() + `\nONCELL_CELL_ID=${cell.id}\n`;
  }
  if (!envContent.includes("ONCELL_API_KEY=")) {
    envContent = `ONCELL_API_KEY=${process.env.ONCELL_API_KEY}\n` + envContent;
  }
  writeFileSync(envPath, envContent);
  console.log(`Saved ONCELL_CELL_ID=${cell.id} to .env.local`);
  console.log(`Run: npm run dev`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
