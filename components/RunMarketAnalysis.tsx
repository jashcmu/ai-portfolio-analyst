// components/RunMarketAnalysis.tsx
"use client";

import { useState } from "react";

type Props = {
  ticker: string;
};

export default function RunMarketAnalysis({ ticker }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Running AI analysis..." : "Run AI market analysis"}
      </button>

      {error && (
        <p className="text-xs text-red-500">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              AI Rating: {result.analysis.rating}
            </span>
            <span className="text-slate-500">
              Conviction: {result.analysis.conviction} / 100
            </span>
          </div>
          <p className="text-slate-700">{result.analysis.summary}</p>
          <p className="font-semibold mt-2 text-slate-800">Key risks</p>
          <ul className="list-disc pl-4 text-slate-600">
            {result.analysis.keyRisks?.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
