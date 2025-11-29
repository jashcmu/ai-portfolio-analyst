"use client";

import { useState } from "react";

type AnalysisResult = {
  confidenceScore: number;
  growthOptimismScore: number;
  uncertaintyScore: number;
  finalToneScore: number;
  summary: string;
  recommendation: string;
};

export default function AnalyzeTranscriptPage() {
  const [ticker, setTicker] = useState("");
  const [quarter, setQuarter] = useState("Q3 FY2026");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!ticker.trim() || !transcript.trim()) {
      setError("Please enter both a ticker and some transcript text.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/analyze-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          quarter,
          transcript,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "API error");
      }

      const data = (await res.json()) as { analysis: AnalysisResult };
      setResult(data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Earnings Call Assistant
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Analyze an Earnings Transcript
          </h1>
          <p className="text-sm text-slate-600">
            Paste an earnings-call excerpt, and the AI will score tone,
            optimism, and uncertainty and give you a recommendation.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm border border-slate-100"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Ticker
              </label>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="NVDA"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-slate-600">
                Quarter / Label
              </label>
              <input
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="Q3 FY2026"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Transcript Excerpt
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              placeholder="Paste a few paragraphs from the earnings call here..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {isLoading ? "Analyzing…" : "Run Analysis"}
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </form>

        {result && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-2 text-sm">
              <h2 className="text-sm font-semibold text-slate-600 mb-1">
                Tone Scores
              </h2>
              <p>Confidence: {result.confidenceScore}</p>
              <p>Growth Optimism: {result.growthOptimismScore}</p>
              <p>Uncertainty: {result.uncertaintyScore}</p>
              <p>Overall Tone: {result.finalToneScore}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-3 text-sm">
              <h2 className="text-sm font-semibold text-slate-600 mb-1">
                Recommendation
              </h2>
              <p className="font-medium">
                Rating: {result.recommendation.toUpperCase()}
              </p>
              <p className="leading-relaxed">{result.summary}</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
