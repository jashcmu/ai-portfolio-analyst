// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Portfolio Analyst",
  description:
    "Data-driven insights, sentiment analysis, and personalized stock recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <a href="/" className="text-xl font-bold text-blue-600">
              AI Portfolio Analyst
            </a>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <a href="/" className="hover:text-blue-600">
                Home
              </a>
              <a href="/compare" className="hover:text-blue-600">
                Compare Stocks
              </a>
              <a href="/portfolio" className="hover:text-blue-600">
                Portfolio Builder
              </a>
              <a href="/transcripts" className="hover:text-blue-600">
                Analyze Transcript
              </a>
              <span className="hidden text-slate-300 md:inline">|</span>
              <span className="hidden text-xs text-slate-400 md:inline">
                (Watchlist & auto-rebalancing – future tabs)
              </span>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
