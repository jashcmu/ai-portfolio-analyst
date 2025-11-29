// app/stocks/[ticker]/page.tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Stock = {
  id: number;
  ticker: string;
  company: string;
  toneScore: number | null;
  growthScore: number | null;
  profitabilityScore: number | null;
  valuationScore: number | null;
  balanceScore: number | null;
  healthScore: number | null;
  rating: string | null;
  notes: string | null;
};

type ApiResponse = {
  stock: Stock;
  snapshot: any;
  analysis: any;
};

export default function StockPage() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const symbol = (segments[segments.length - 1] || "").toUpperCase();

  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Run analysis automatically when the page loads
  useEffect(() => {
    if (!symbol) return;

    const runAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analyze-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: symbol }),
        });

        const data: ApiResponse | { error: string } = await res.json();

        if (!res.ok) {
          throw new Error(
            (data as any).error || "Failed to run stock analysis."
          );
        }

        setStock((data as ApiResponse).stock);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Something went wrong while analyzing.");
      } finally {
        setLoading(false);
      }
    };

    runAnalysis();
  }, [symbol]);

  async function handleReanalyze() {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });

      const data: ApiResponse | { error: string } = await res.json();

      if (!res.ok) {
        throw new Error(
          (data as any).error || "Failed to re-run stock analysis."
        );
      }

      setStock((data as ApiResponse).stock);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Something went wrong while re-analyzing.");
    } finally {
      setLoading(false);
    }
  }

  if (!symbol) {
    return (
      <main className="max-w-4xl mx-auto py-12">
        <h1 className="text-2xl font-semibold mb-4">No ticker specified</h1>
        <p className="text-slate-600">
          Try searching for a stock symbol from the home page (for example:{" "}
          <span className="font-mono">AAPL</span>,{" "}
          <span className="font-mono">NVDA</span>,{" "}
          <span className="font-mono">TSLA</span>).
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto py-10 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
          <p className="text-slate-500">
            {stock?.company ??
              "No company information stored yet for this ticker."}
          </p>
        </div>

        <button
          onClick={handleReanalyze}
          disabled={loading}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Running AI analysis..." : "Re-run AI market analysis"}
        </button>
      </header>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}

      {/* If there is no stock yet, show a message */}
      {!stock && !loading && !error && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8">
          <h2 className="text-lg font-semibold mb-2">No analysis yet</h2>
          <p className="text-sm text-slate-600 mb-3">
            We&apos;re waiting for the analysis results for{" "}
            <span className="font-mono">{symbol}</span>.
          </p>
          <p className="text-sm text-slate-600">
            If this message doesn&apos;t change, click{" "}
            <span className="font-semibold">Re-run AI market analysis</span> above.
          </p>
        </section>
      )}

      {/* When the stock exists, show its scores */}
      {stock && (
        <section className="grid gap-4 md:grid-cols-2">
          {/* Health / rating */}
          <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500 mb-2">
              OVERALL RECOMMENDATION
            </h2>
            <p className="text-4xl font-bold mb-1">
              {stock.healthScore ?? "--"}
            </p>
            <p className="uppercase text-xs tracking-wide text-emerald-600 font-semibold">
              {stock.rating ?? "N/A"}
            </p>
            <p className="text-sm text-slate-600 mt-3">
              {stock.notes ?? "No notes saved yet for this stock."}
            </p>
          </div>

          {/* Breakdown */}
          <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 mb-2">
              SCORE BREAKDOWN (0–100)
            </h2>
            <ScoreRow label="Tone" value={stock.toneScore} />
            <ScoreRow label="Growth" value={stock.growthScore} />
            <ScoreRow label="Profitability" value={stock.profitabilityScore} />
            <ScoreRow label="Valuation" value={stock.valuationScore} />
            <ScoreRow label="Balance (risk/reward)" value={stock.balanceScore} />
            <ScoreRow label="Health" value={stock.healthScore} />
          </div>
        </section>
      )}
    </main>
  );
}

function ScoreRow({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold">{value ?? "--"}</span>
    </div>
  );
}
