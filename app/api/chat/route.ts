import { NextRequest, NextResponse } from "next/server";
import { getOnCell, getCellId } from "@/lib/oncell";

export async function POST(req: NextRequest) {
  try {
    const { query, session_id } = await req.json();
    if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

    const oncell = getOnCell();
    const cellId = getCellId();

    const result = await oncell.cells.request<{
      answer: string;
      sources: { index: number; title: string; url: string; content: string }[];
      query: string;
      error?: string;
    }>(cellId, "research", { query, session_id: session_id || "default" });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("research error:", err.message);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
