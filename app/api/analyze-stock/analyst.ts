// app/api/analyze-stock/analyst.ts
// Pure quantitative scoring logic for a single stock, no OpenAI calls.

import type { MarketSnapshot } from "@/lib/fetchYahooRapid";

export type MarketRating = "BUY" | "HOLD" | "SELL";

export type MarketAnalysis = {
  rating: MarketRating;
  conviction: number; // 0–100
  toneScore: number; // 0–100 (short-term sentiment / momentum proxy)
  growthScore: number; // 0–100 (growth + upside)
  profitabilityScore: number; // 0–100
  valuationScore: number; // 0–100 (higher = cheaper/healthier valuation)
  balanceScore: number; // 0–100 (risk/reward balance)
  healthScore: number; // 0–100 overall
  summary: string;
  keyRisks: string[];
  thesis: string;
};

export const FALLBACK_ANALYSIS: MarketAnalysis = {
  rating: "HOLD",
  conviction: 50,
  toneScore: 50,
  growthScore: 50,
  profitabilityScore: 50,
  valuationScore: 50,
  balanceScore: 50,
  healthScore: 50,
  summary:
    "We did not have enough reliable market data to generate a high-confidence view. Treat this as a neutral placeholder until fresher data is available.",
  keyRisks: ["Insufficient or inconsistent market data."],
  thesis:
    "With limited data, the model cannot clearly tilt toward bullish or bearish; maintaining a neutral hold stance is prudent.",
};

// ---------- helpers ----------

function clean(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// map any z-score-ish value in [-3, +3] to [0, 100]
function zToScore(z: number): number {
  const zClamped = Math.max(-3, Math.min(3, z));
  const normalized = (zClamped + 3) / 6; // 0..1
  return Math.round(normalized * 100);
}

// convenience
function toScore(
  value: number | null,
  opts: { min: number; max: number; invert?: boolean }
): number | null {
  if (value == null) return null;
  const { min, max, invert } = opts;
  if (max === min) return null;
  let ratio = (value - min) / (max - min);
  ratio = clamp01(ratio);
  if (invert) ratio = 1 - ratio;
  return Math.round(ratio * 100);
}

// ---------- core quant model ----------

// This is where we turn a MarketSnapshot into a set of scores.
export function computeQuantAnalysis(
  snapshot: MarketSnapshot | null
): MarketAnalysis {
  if (!snapshot) {
    return FALLBACK_ANALYSIS;
  }

  const {
    ticker,
    companyName,
    price,
    change1d,
    change1m,
    changeFrom52wLowPct,
    changeFrom52wHighPct,
    marketCap,
    peRatio,
  } = snapshot;

  const p = clean(price);
  const d1 = clean(change1d);
  const d30 = clean(change1m);
  const fromLow = clean(changeFrom52wLowPct);
  const fromHigh = clean(changeFrom52wHighPct);
  const mcap = clean(marketCap);
  const pe = clean(peRatio);

  // ---- Tone / short-term sentiment ----
  // 1-day move, 30-day move, and position vs 52-week range.
  let toneParts: number[] = [];

  const tone1d = d1 != null ? zToScore(d1 / 5) : null; // ±5% ~ ±1 z
  if (tone1d != null) toneParts.push(tone1d);

  const tone30 = d30 != null ? zToScore(d30 / 30) : null; // ±30% ~ ±1 z
  if (tone30 != null) toneParts.push(tone30);

  if (fromLow != null && fromHigh != null) {
    // closer to low = weak tone, closer to high = strong tone
    const totalRange = fromLow - fromHigh; // from -x to +y
    if (totalRange !== 0) {
      const pos = fromLow / totalRange; // rough 0..1 position
      const rangeTone = Math.round(clamp01(pos) * 100);
      toneParts.push(rangeTone);
    }
  }

  const toneScore =
    toneParts.length > 0
      ? Math.round(
          toneParts.reduce((a, b) => a + b, 0) / toneParts.length
        )
      : 50;

  // ---- Growth score ----
  // Use 30-day performance and market-cap size as rough growth proxies.
  const growthParts: number[] = [];

  const growth30 = toScore(d30, { min: -30, max: 60 }); // -30%..+60%
  if (growth30 != null) growthParts.push(growth30);

  // Smaller/mid caps often have more upside than mega caps
  if (mcap != null) {
    const growthSize = toScore(mcap, {
      min: 5e9, // 5B
      max: 1e12, // 1T
      invert: true, // smaller = higher score, up to a point
    });
    if (growthSize != null) growthParts.push(growthSize);
  }

  const growthScore =
    growthParts.length > 0
      ? Math.round(
          growthParts.reduce((a, b) => a + b, 0) / growthParts.length
        )
      : 50;

  // ---- Profitability score ----
  // Without detailed margins, we proxy via market cap & valuation:
  // big + positive momentum often implies strong earnings power.
  const profitParts: number[] = [];

  if (mcap != null) {
    const sizeScore = toScore(mcap, {
      min: 2e9,
      max: 1.5e12,
    });
    if (sizeScore != null) profitParts.push(sizeScore);
  }

  if (d30 != null) {
    const momScore = toScore(d30, { min: -20, max: 40 });
    if (momScore != null) profitParts.push(momScore);
  }

  const profitabilityScore =
    profitParts.length > 0
      ? Math.round(
          profitParts.reduce((a, b) => a + b, 0) / profitParts.length
        )
      : 50;

  // ---- Valuation score ----
  // Lower P/E is better, but we also avoid extremely low (potential value traps).
  let valuationScore = 50;
  if (pe != null) {
    // Typical band ~ [5, 60]
    const cheapScore = toScore(pe, { min: 5, max: 60, invert: true });
    valuationScore = cheapScore != null ? cheapScore : 50;

    // Penalize absolutely extreme valuations > 80
    if (pe > 80) {
      valuationScore = Math.max(0, valuationScore - 15);
    }
  }

  // ---- Balance (risk / reward) ----
  // Combine volatility proxies and valuation.
  const balanceParts: number[] = [];

  // Closer to middle of 52w range is more balanced; extremes mean skewed risk.
  if (fromLow != null && fromHigh != null) {
    const span = fromLow - fromHigh; // negative number typically
    if (span !== 0) {
      const pos = fromLow / span; // 0..1
      const mid = Math.abs(pos - 0.5);
      const balanceMid = Math.round((1 - clamp01(mid * 2)) * 100); // center ~100
      balanceParts.push(balanceMid);
    }
  }

  // Good valuation improves balance
  balanceParts.push(valuationScore);

  const balanceScore =
    balanceParts.length > 0
      ? Math.round(
          balanceParts.reduce((a, b) => a + b, 0) / balanceParts.length
        )
      : 50;

  // ---- Overall health ----
  const health =
    (toneScore * 0.15 +
      growthScore * 0.25 +
      profitabilityScore * 0.25 +
      valuationScore * 0.15 +
      balanceScore * 0.2) /
    1;

  const healthScore = Math.round(health);

  // ---- Rating + conviction rules ----
  let rating: MarketRating = "HOLD";
  let conviction = 50;

  if (
    healthScore >= 70 &&
    balanceScore >= 65 &&
    growthScore >= 65 &&
    valuationScore >= 50
  ) {
    rating = "BUY";
    conviction = Math.round(
      (healthScore + growthScore + balanceScore) / 3
    );
  } else if (
    healthScore <= 40 ||
    balanceScore <= 40 ||
    valuationScore <= 35
  ) {
    rating = "SELL";
    conviction = Math.round(
      (100 - healthScore + (100 - balanceScore)) / 2
    );
  } else {
    rating = "HOLD";
    conviction = Math.round(
      (60 + Math.abs(healthScore - 50)) / 1.2
    );
  }

  // ---- Human-readable text ----
  const name = companyName ?? ticker;

  const summary = `${name} currently trades with a blended health score of ${healthScore} and a risk/reward balance of ${balanceScore}. Growth and profitability are scored at ${growthScore} and ${profitabilityScore}, with a valuation score of ${valuationScore}. This profile leads to a ${rating} rating with conviction around ${conviction} on a 0–100 scale.`;

  const keyRisks: string[] = [];

  if (toneScore < 45) {
    keyRisks.push(
      "Recent price action and short-term sentiment have been weak."
    );
  }
  if (valuationScore < 45) {
    keyRisks.push(
      "Valuation appears elevated relative to typical earnings multiples."
    );
  }
  if (growthScore < 45) {
    keyRisks.push(
      "Forward growth signals are mixed or below market leaders."
    );
  }
  if (keyRisks.length === 0) {
    keyRisks.push(
      "Standard market, macro, and company-specific risks apply."
    );
  }

  const thesis =
    rating === "BUY"
      ? `${name} screens well on overall health, with a solid mix of growth, profitability, and a risk profile that looks acceptable for new capital. For investors comfortable with the volatility and sector exposure, the risk/reward skew is favourable.`
      : rating === "SELL"
      ? `${name} currently scores poorly on either health, valuation, or balance, suggesting limited upside versus the risks. Investors with better alternatives may want to reduce or exit exposure unless they have a differentiated thesis.`
      : `${name} sits in a middle ground where the upside case is not strong enough to warrant an aggressive add, but the downside case is not severe enough for an outright exit. Maintaining a HOLD stance and monitoring future quarters is reasonable.`;

  return {
    rating,
    conviction,
    toneScore,
    growthScore,
    profitabilityScore,
    valuationScore,
    balanceScore,
    healthScore,
    summary,
    keyRisks,
    thesis,
  };
}
