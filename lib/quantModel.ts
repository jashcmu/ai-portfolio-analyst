// lib/quantModel.ts
// Shared quant model for scoring a MarketSnapshot into MarketAnalysis

import type { MarketSnapshot } from "./fetchYahooRapid";

export type MarketAnalysis = {
  rating: "BUY" | "HOLD" | "SELL";
  conviction: number;
  toneScore: number;
  growthScore: number;
  profitabilityScore: number;
  valuationScore: number;
  balanceScore: number;
  healthScore: number;
  summary: string;
  keyRisks: string[];
  thesis: string;
};

/* ---------------- helpers ---------------- */

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function safeNum(n: any): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Average of non-null scores; if none, return 50. */
function avgScores(scores: (number | null)[]): number {
  const vals = scores.filter(
    (s) => typeof s === "number" && !Number.isNaN(s)
  ) as number[];
  if (vals.length === 0) return 50;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round(sum / vals.length);
}

/** Average of non-null scores; if none, return null. */
function avgScoresOrNull(scores: (number | null)[]): number | null {
  const vals = scores.filter(
    (s) => typeof s === "number" && !Number.isNaN(s)
  ) as number[];
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round(sum / vals.length);
}

/** Map a numeric value in [min, max] to [10, 95]; null → 50. */
function scoreFromBand(
  value: number | null,
  min: number,
  max: number
): number {
  if (value == null) return 50;
  if (value <= min) return 10;
  if (value >= max) return 95;
  const t = (value - min) / (max - min);
  return 10 + t * (95 - 10);
}

/** Same, but returns null if input is null, so we can ignore it in avg. */
function scoreFromBandOrNull(
  value: number | null,
  min: number,
  max: number
): number | null {
  if (value == null) return null;
  if (value <= min) return 10;
  if (value >= max) return 95;
  const t = (value - min) / (max - min);
  return 10 + t * (95 - 10);
}

/** P/E curve: sweet spot ~10–25, penalize extremes. */
function scoreFromPeOrNull(peRaw: number | null): number | null {
  const pe = safeNum(peRaw);
  if (pe == null) return null;
  if (pe <= 0) return 20;

  if (pe >= 5 && pe <= 15) {
    const t = (pe - 5) / 10;
    // 5 → 95, 15 → 80 (cheaper gets rewarded)
    return Math.round(95 - t * 15);
  }

  if (pe > 15 && pe <= 30) {
    const t = (pe - 15) / 15;
    // 15 → 80, 30 → 55
    return Math.round(80 - t * 25);
  }

  if (pe > 30 && pe <= 60) {
    const t = (pe - 30) / 30;
    // 30 → 55, 60 → 40
    return Math.round(55 - t * 15);
  }

  // > 60 very expensive
  return 35;
}

/* ---------------- factor scores ---------------- */

function scoreValue(s: MarketSnapshot): number {
  const peScore = scoreFromPeOrNull(s.peRatio);
  const psScore = scoreFromBandOrNull(s.priceToSales, 1, 12); // 1–12x sales
  const pbScore = scoreFromBandOrNull(s.priceToBook, 0.8, 6); // 0.8–6x book
  const pegScore = scoreFromBandOrNull(s.pegRatio, 0.5, 3);   // 0.5–3 PEG

  return avgScores([peScore, psScore, pbScore, pegScore]);
}

/**
 * GROWTH:
 * - First preference: fundamental growth (revenueGrowth, epsGrowth).
 * - Fallback: price-based growth (52w performance).
 * - If 52w change is missing, fallback to position in 52w range.
 */
function scoreGrowth(s: MarketSnapshot): number {
  const revFundScore = scoreFromBandOrNull(s.revenueGrowth, 0, 0.35); // 0–35%+
  const epsFundScore = scoreFromBandOrNull(s.epsGrowth, 0, 0.45);     // 0–45%+

  const fundamentalGrowthScore = avgScoresOrNull([
    revFundScore,
    epsFundScore,
  ]);

  let priceGrowthScore: number | null = null;

  if (s.fiftyTwoWeekChangePct != null) {
    priceGrowthScore = scoreFromBandOrNull(
      s.fiftyTwoWeekChangePct,
      -40,
      150
    ); // -40%..+150%
  } else if (
    s.price != null &&
    s.fiftyTwoWeekLow != null &&
    s.fiftyTwoWeekHigh != null &&
    s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow
  ) {
    const pos =
      (s.price - s.fiftyTwoWeekLow) /
      (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow);
    priceGrowthScore = scoreFromBandOrNull(pos, 0, 1);
  }

  const combined = avgScores(
    fundamentalGrowthScore != null
      ? [fundamentalGrowthScore, priceGrowthScore]
      : [priceGrowthScore]
  );

  return combined;
}

function scoreQuality(s: MarketSnapshot): number {
  const marginScore = scoreFromBandOrNull(s.profitMargin, 0.05, 0.35); // 5–35% margin
  const roeScore = scoreFromBandOrNull(s.roe, 0.08, 0.35);             // 8–35% ROE
  return avgScores([marginScore, roeScore]);
}

function scoreMomentum(s: MarketSnapshot): number {
  const dayScore = scoreFromBandOrNull(s.change1dPct, -5, 5); // -5%..+5%

  const yearScore = scoreFromBandOrNull(
    s.fiftyTwoWeekChangePct,
    -40,
    150
  ); // -40%..+150%

  const distFromHighScore = scoreFromBandOrNull(
    s.changeFrom52wHighPct != null
      ? -Math.abs(s.changeFrom52wHighPct)
      : null,
    -60,
    0
  ); // 0..-60%

  return avgScores([dayScore, yearScore, distFromHighScore]);
}

function scoreRisk(s: MarketSnapshot): number {
  const betaScore = scoreFromBandOrNull(s.beta, 0.8, 1.8); // 0.8–1.8
  let sizeScore: number | null = null;

  if (s.marketCap && s.marketCap > 0) {
    const logCap = Math.log10(s.marketCap); // ~9–12
    sizeScore = scoreFromBandOrNull(logCap, 9, 12);
  }

  return avgScores([betaScore, sizeScore]);
}

/* ---------------- quant → app scores ---------------- */

export function computeQuantAnalysis(
  snapshot: MarketSnapshot
): MarketAnalysis {
  const valueScore = scoreValue(snapshot);
  const growthScore = scoreGrowth(snapshot);
  const qualityScore = scoreQuality(snapshot);
  const momentumScore = scoreMomentum(snapshot);
  const riskScore = scoreRisk(snapshot);

  const toneScore = momentumScore;
  const valuationScore = valueScore;
  const profitabilityScore = qualityScore;

  const balanceScore = Math.round(
    valueScore * 0.25 +
      qualityScore * 0.25 +
      growthScore * 0.25 +
      riskScore * 0.15 +
      momentumScore * 0.10
  );

  const healthScore = Math.round(
    valueScore * 0.20 +
      qualityScore * 0.25 +
      growthScore * 0.30 +
      momentumScore * 0.15 +
      riskScore * 0.10
  );

  let rating: "BUY" | "HOLD" | "SELL" = "HOLD";
  if (healthScore >= 72 && balanceScore >= 60) {
    rating = "BUY";
  } else if (healthScore <= 40 || balanceScore <= 40) {
    rating = "SELL";
  }

  const distanceFromNeutral = Math.abs(healthScore - 50);
  const conviction = clamp(35 + distanceFromNeutral, 10, 90);

  const name = snapshot.companyName ?? snapshot.ticker;

  const summary = `Quantitative snapshot for ${name} (${snapshot.ticker}) using valuation (P/E, PEG, P/S, P/B), growth (fundamental & price-based), profitability (margin & ROE), momentum, and basic risk proxies.`;
  const thesis = `The composite health score of ${healthScore} blends ${growthScore} for growth, ${profitabilityScore} for profitability, ${valuationScore} for valuation, and ${riskScore} for risk characteristics. This currently supports a ${rating} stance with about ${conviction}% conviction given the available data.`;

  const keyRisks: string[] = [];

  if (snapshot.profitMargin == null || snapshot.roe == null) {
    keyRisks.push(
      "Profitability metrics (margin/ROE) are partially missing or estimated – interpret profitability-related scores with some caution."
    );
  }
  if (snapshot.revenueGrowth == null || snapshot.epsGrowth == null) {
    keyRisks.push(
      "Growth fundamentals are incomplete, so the growth score leans more heavily on price-based momentum and position in the 52-week range."
    );
  }
  if (keyRisks.length === 0) {
    keyRisks.push(
      "Scores are based on trailing data and do not incorporate forward guidance, breaking news, or macro shocks."
    );
  }

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
