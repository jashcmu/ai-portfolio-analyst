// app/portfolio/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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

type RecommendedStock = {
  id: number;
  ticker: string;
  company: string;
  rating: string | null;
  toneScore: number | null;
  growthScore: number | null;
  profitabilityScore: number | null;
  valuationScore: number | null;
  balanceScore: number | null;
  healthScore: number | null;
  profileScore: number;
};

type Position = {
  ticker: string;
  weight: number; // percentage, e.g. 35 = 35%
};

type RiskProfile = "conservative" | "balanced" | "aggressive";

export default function PortfolioPage() {
  const [riskProfile, setRiskProfile] =
    useState<RiskProfile>("balanced");
  const [positions, setPositions] = useState<Position[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [newWeight, setNewWeight] = useState<string>("");
  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // recommendations
  const [recommended, setRecommended] = useState<RecommendedStock[]>(
    []
  );
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // Load from localStorage on first render
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(
        "ai-portfolio-positions"
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Position[];
        if (Array.isArray(parsed)) {
          setPositions(parsed);
        }
      }
      const rawRisk = window.localStorage.getItem(
        "ai-portfolio-risk"
      ) as RiskProfile | null;
      if (
        rawRisk === "conservative" ||
        rawRisk === "balanced" ||
        rawRisk === "aggressive"
      ) {
        setRiskProfile(rawRisk);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "ai-portfolio-positions",
      JSON.stringify(positions)
    );
  }, [positions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ai-portfolio-risk", riskProfile);
  }, [riskProfile]);

  // Whenever positions change, fetch stock data for those tickers
  useEffect(() => {
    async function fetchStocks() {
      setError(null);
      if (positions.length === 0) {
        setStocks([]);
        return;
      }

      const tickers = Array.from(
        new Set(
          positions
            .map((p) => p.ticker.trim().toUpperCase())
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
      } catch (e: any) {
        setError(e.message || "Unexpected error");
        setStocks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStocks();
  }, [positions]);

  function handleAddPosition(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const t = newTicker.trim().toUpperCase();
    const w = Number(newWeight);

    if (!t) {
      setError("Please enter a ticker.");
      return;
    }
    if (!Number.isFinite(w) || w <= 0) {
      setError("Weight must be a positive number.");
      return;
    }

    setPositions((prev) => {
      const existing = prev.find(
        (p) => p.ticker.toUpperCase() === t
      );
      if (existing) {
        return prev.map((p) =>
          p.ticker.toUpperCase() === t
            ? { ...p, weight: p.weight + w }
            : p
        );
      }
      return [...prev, { ticker: t, weight: w }];
    });

    setNewTicker("");
    setNewWeight("");
  }

  function handleRemovePosition(ticker: string) {
    setPositions((prev) =>
      prev.filter(
        (p) => p.ticker.toUpperCase() !== ticker.toUpperCase()
      )
    );
  }

  // Map ticker -> StockRecord
  const stockMap = useMemo(() => {
    const map: Record<string, StockRecord> = {};
    for (const s of stocks) {
      map[s.ticker.toUpperCase()] = s;
    }
    return map;
  }, [stocks]);

  const totalWeight = positions.reduce(
    (sum, p) => sum + (Number.isFinite(p.weight) ? p.weight : 0),
    0
  );

  function weightedScore(
    key: keyof Pick<
      StockRecord,
      | "toneScore"
      | "growthScore"
      | "profitabilityScore"
      | "valuationScore"
      | "balanceScore"
      | "healthScore"
    >
  ): number | null {
    if (positions.length === 0 || totalWeight <= 0) return null;

    let weightedSum = 0;
    let weightSum = 0;

    for (const p of positions) {
      const s = stockMap[p.ticker.toUpperCase()];
      const v = s?.[key];
      if (v == null || !Number.isFinite(v)) continue;
      const w = p.weight;
      weightedSum += v * w;
      weightSum += w;
    }

    if (weightSum <= 0) return null;
    return Math.round(weightedSum / weightSum);
  }

  const portfolioTone = weightedScore("toneScore");
  const portfolioGrowth = weightedScore("growthScore");
  const portfolioProfitability = weightedScore("profitabilityScore");
  const portfolioValuation = weightedScore("valuationScore");
  const portfolioBalance = weightedScore("balanceScore");
  const portfolioHealth = weightedScore("healthScore");

  function describeFit(): string {
    if (
      portfolioHealth == null ||
      portfolioBalance == null ||
      portfolioGrowth == null
    ) {
      return "Once you add a few positions and weights, we’ll evaluate how well this mix matches your risk preference.";
    }

    if (riskProfile === "conservative") {
      if (portfolioBalance >= 70 && portfolioHealth >= 70) {
        return "This portfolio looks relatively conservative and well-balanced, which fits a capital-preservation mindset.";
      }
      if (portfolioGrowth > 70 && portfolioBalance < 60) {
        return "This mix leans more aggressive than a typical conservative profile – you’re taking on more growth and volatility.";
      }
      return "Overall this sits somewhere between conservative and balanced – some growth exposure, but with a decent risk/reward profile.";
    }

    if (riskProfile === "aggressive") {
      if (portfolioGrowth >= 75) {
        return "This portfolio is strongly tilted toward growth, which fits an aggressive risk profile focused on upside.";
      }
      if (
        portfolioBalance >= 70 &&
        portfolioHealth >= 70 &&
        portfolioGrowth < 65
      ) {
        return "This mix is quite high quality and balanced, but may be a bit too cautious for a truly aggressive investor.";
      }
      return "You have a blended profile: some growth, some balance. You could lean more into high-growth names if you want maximum risk/reward.";
    }

    // balanced
    if (
      portfolioHealth >= 65 &&
      portfolioBalance >= 60 &&
      portfolioGrowth >= 55 &&
      portfolioGrowth <= 75
    ) {
      return "This portfolio lines up well with a balanced profile – reasonable growth with a decent cushion from quality and valuation.";
    }
    if (portfolioGrowth > 80) {
      return "This mix is skewed more toward aggressive growth than a typical balanced portfolio – great upside, but be mindful of volatility.";
    }
    if (portfolioBalance < 55) {
      return "Risk/reward looks a bit stretched for a balanced profile – you may want to tilt slightly toward steadier names.";
    }
    return "You’re somewhere in between profiles – not extremely aggressive, but not fully defensive either.";
  }

  /* ---------- recommendations: based on riskProfile + exclude current positions ---------- */

  useEffect(() => {
    async function fetchRecommendations() {
      setRecError(null);
      setRecLoading(true);

      const excludeTickers = positions
        .map((p) => p.ticker.trim().toUpperCase())
        .filter(Boolean);

      const params = new URLSearchParams();
      params.set("riskProfile", riskProfile);
      if (excludeTickers.length > 0) {
        params.set("exclude", excludeTickers.join(","));
      }

      try {
        const res = await fetch(
          `/api/recommend-stocks?${params.toString()}`
        );
        const data = await res.json();
        if (!res.ok) {
          setRecError(
            data.error || "Failed to fetch recommendations."
          );
          setRecommended([]);
          return;
        }
        setRecommended(data || []);
      } catch (e: any) {
        setRecError(e.message || "Unexpected error");
        setRecommended([]);
      } finally {
        setRecLoading(false);
      }
    }

    fetchRecommendations();
  }, [riskProfile, positions]);

  function handleAddRecommended(ticker: string) {
    setPositions((prev) => {
      const t = ticker.toUpperCase();
      const existing = prev.find(
        (p) => p.ticker.toUpperCase() === t
      );
      if (existing) {
        return prev.map((p) =>
          p.ticker.toUpperCase() === t
            ? { ...p, weight: p.weight + 10 }
            : p
        );
      }
      return [...prev, { ticker: t, weight: 10 }];
    });
  }

  function handleGenerateStarterPortfolio() {
    if (!recommended || recommended.length === 0) return;

    const top = recommended.slice(0, 5);
    const baseWeights = [30, 25, 20, 15, 10];

    const newPositions: Position[] = top.map((s, idx) => ({
      ticker: s.ticker.toUpperCase(),
      weight: baseWeights[idx] ?? 10,
    }));

    setPositions(newPositions);
  }

  return (
    <div className="space-y-10">
      {/* Header + risk selector */}
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">
          Portfolio Builder
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Build a simple portfolio using tickers and weights. We’ll
          combine your stocks&apos; AI scores into a single
          portfolio-level view and interpret it based on your risk
          preference.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">
            Risk preference:
          </span>
          <div className="inline-flex overflow-hidden rounded-full border bg-white text-xs shadow-sm">
            <button
              type="button"
              onClick={() => setRiskProfile("conservative")}
              className={`px-4 py-1 ${
                riskProfile === "conservative"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Conservative
            </button>
            <button
              type="button"
              onClick={() => setRiskProfile("balanced")}
              className={`px-4 py-1 ${
                riskProfile === "balanced"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Balanced
            </button>
            <button
              type="button"
              onClick={() => setRiskProfile("aggressive")}
              className={`px-4 py-1 ${
                riskProfile === "aggressive"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Aggressive
            </button>
          </div>
        </div>
      </section>

      {/* Positions editor */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Your positions
        </h2>
        <p className="text-sm text-slate-600">
          Add tickers with approximate weights (they don&apos;t have to
          add up exactly to 100 – we&apos;ll normalize them).
        </p>

        <form
          onSubmit={handleAddPosition}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600">
              Ticker
            </label>
            <input
              className="mt-1 w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              placeholder="Example: NVDA"
              value={newTicker}
              onChange={(e) =>
                setNewTicker(e.target.value.toUpperCase())
              }
            />
          </div>
          <div className="w-full md:w-40">
            <label className="block text-xs font-semibold text-slate-600">
              Weight (%)
            </label>
            <input
              className="mt-1 w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              placeholder="e.g., 40"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="mt-1 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 md:mt-6"
          >
            Add / Update
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {positions.length > 0 ? (
          <PositionsTable
            positions={positions}
            stockMap={stockMap}
            totalWeight={totalWeight}
            onRemove={handleRemovePosition}
          />
        ) : (
          <p className="text-sm text-slate-500">
            No positions yet. Add a few tickers above or generate a
            starter portfolio from the suggestions below.
          </p>
        )}

        {loading && (
          <p className="text-xs text-slate-400">
            Loading stock scores…
          </p>
        )}
      </section>

      {/* Portfolio scores + fit */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500">
            Portfolio Scores (0–100)
          </h2>

          <ScoreRow label="Tone" value={portfolioTone} />
          <ScoreRow label="Growth" value={portfolioGrowth} />
          <ScoreRow
            label="Profitability"
            value={portfolioProfitability}
          />
          <ScoreRow
            label="Valuation"
            value={portfolioValuation}
          />
          <ScoreRow
            label="Balance (Risk/Reward)"
            value={portfolioBalance}
          />
          <ScoreRow label="Health" value={portfolioHealth} />
        </div>

        <div className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500">
            How does this fit your profile?
          </h2>
          <p className="text-sm text-slate-700">
            {describeFit()}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Note: these scores are based on trailing fundamentals and
            price behavior. They don&apos;t account for breaking news
            or personal constraints like taxes or liquidity needs.
          </p>
        </div>
      </section>

      {/* Recommendations */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              Suggested stocks for your profile
            </h2>
            <p className="text-sm text-slate-600">
              Ranked using your risk preference and the latest AI
              scores saved in the app.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {recLoading && (
              <span className="text-xs text-slate-400">
                Refreshing…
              </span>
            )}
            <button
              type="button"
              onClick={handleGenerateStarterPortfolio}
              disabled={recommended.length === 0 || recLoading}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
            >
              Generate starter portfolio
            </button>
          </div>
        </div>

        {recError && (
          <p className="text-sm text-red-600">{recError}</p>
        )}

        {!recError && !recLoading && recommended.length === 0 && (
          <p className="text-sm text-slate-500">
            No suggestions yet. Try running AI market analysis on a
            few more tickers from the Home page so the recommendation
            engine has more data to work with.
          </p>
        )}

        {recommended.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommended.map((s) => (
              <div
                key={s.id}
                className="flex flex-col justify-between rounded-2xl border bg-white p-4 text-sm shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {s.ticker}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.company}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Profile score
                      </p>
                      <p className="text-xl font-bold text-blue-600">
                        {s.profileScore}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide">
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
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                    <SmallScore label="Health" value={s.healthScore} />
                    <SmallScore label="Growth" value={s.growthScore} />
                    <SmallScore
                      label="Profit"
                      value={s.profitabilityScore}
                    />
                    <SmallScore
                      label="Valuation"
                      value={s.valuationScore}
                    />
                    <SmallScore
                      label="Balance"
                      value={s.balanceScore}
                    />
                    <SmallScore label="Tone" value={s.toneScore} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddRecommended(s.ticker)}
                  className="mt-4 w-full rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                >
                  Add 10% to portfolio
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function PositionsTable({
  positions,
  stockMap,
  totalWeight,
  onRemove,
}: {
  positions: Position[];
  stockMap: Record<string, StockRecord>;
  totalWeight: number;
  onRemove: (ticker: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ticker
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Company
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Weight (%)
            </th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const s = stockMap[p.ticker.toUpperCase()];
            return (
              <tr
                key={p.ticker}
                className="border-t last:border-b-0"
              >
                <td className="px-4 py-2 font-mono font-semibold">
                  {p.ticker}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {s?.company ?? (
                    <span className="text-slate-400">
                      No saved analysis yet
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{p.weight}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(p.ticker)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="border-t bg-slate-50">
            <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </td>
            <td></td>
            <td className="px-4 py-2 text-sm font-semibold text-slate-800">
              {totalWeight}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ScoreRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">
        {value == null ? "--" : value}
      </span>
    </div>
  );
}

function SmallScore({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1">
      <span>{label}</span>
      <span className="font-semibold">
        {value == null ? "--" : value}
      </span>
    </div>
  );
}
