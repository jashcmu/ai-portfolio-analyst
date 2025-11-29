// app/compare/page.tsx
"use client";

import { useState } from "react";

type StockRecord = {
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

export default function ComparePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const raw = input.trim();
    if (!raw) {
      setStocks([]);
      return;
    }

    const tickers = Array.from(
      new Set(
        raw
          .split(/[,\s]+/)
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    if (tickers.length === 0) {
      setStocks([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/compare-stocks?tickers=${encodeURIComponent(
          tickers.join(",")
        )}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch stock data.");
        setStocks([]);
        return;
      }

      setStocks(data || []);
      if ((data || []).length === 0) {
        setError(
          "No matching stocks found in the database. Try running AI market analysis on those tickers first."
        );
      }
    } catch (e: any) {
      setError(e.message || "Unexpected error");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }

  const metrics = [
    { key: "toneScore", label: "Tone" },
    { key: "growthScore", label: "Growth" },
    { key: "profitabilityScore", label: "Profitability" },
    { key: "valuationScore", label: "Valuation" },
    { key: "balanceScore", label: "Balance (Risk/Reward)" },
    { key: "healthScore", label: "Health" },
  ] as const;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">
          Compare Stocks Side by Side
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Enter one or more tickers (separated by commas or spaces) to
          compare their AI-derived scores across growth, profitability,
          valuation, balance, and overall health.
        </p>

        <form
          onSubmit={handleCompare}
          className="mt-4 flex flex-col gap-3 md:flex-row"
        >
          <input
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            placeholder="Example: AAPL NVDA TGT"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Comparing..." : "Compare"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </section>

      {stocks.length > 0 && (
        <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Metric
                </th>
                {stocks.map((s) => (
                  <th
                    key={s.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">
                        {s.ticker}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {s.company}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {m.label}
                  </td>
                  {stocks.map((s) => {
                    const value = s[m.key];
                    return (
                      <td
                        key={`${s.id}-${m.key}`}
                        className="px-4 py-3 text-slate-800"
                      >
                        {value ?? "--"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">
                  Rating
                </td>
                {stocks.map((s) => (
                  <td
                    key={`${s.id}-rating`}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                  >
                    <span
                      className={
                        s.rating === "BUY"
                          ? "text-emerald-600"
                          : s.rating === "SELL"
                          ? "text-red-600"
                          : "text-slate-600"
                      }
                    >
                      {s.rating ?? "N/A"}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
