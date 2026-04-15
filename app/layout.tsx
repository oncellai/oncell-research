import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research — Powered by OnCell",
  description: "AI research agent — search the web, get synthesized answers with sources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {children}
      </body>
    </html>
  );
}
