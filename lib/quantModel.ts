// lib/quantModel.ts
// Lightweight, type-safe placeholder quant model.
// Your real scoring logic lives in app/api/analyze-stock/analyst.ts.
// This file exists so TypeScript has a clean, reusable type if you
// want to import it elsewhere in the future.

import type { MarketSnapshot } from "@/lib/fetchYahooRapid";

export type MarketRating = "BUY" | "HOLD" | "SELL";

export type MarketAnalysis = {
  rating: MarketRating;
  conviction: number; // 0–100
  toneScore: number; // 0–100
  growthScore: number; // 0–100
  profitabilityScore: number; // 0–100
  valuationScore: number; // 0–100
  balanceScore: number; // 0–100
  healthScore: number; // 0–100
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
    "Placeholder quant analysis. The detailed scoring engine is implemented in app/api/analyze-stock/analyst.ts.",
  keyRisks: ["Insufficient model inputs for a detailed quant view."],
  thesis:
    "Without full fundamentals and price history, the quant model returns a neutral hold stance by default.",
};

// Simple, safe implementation so TS is happy.
// Not currently used by your /api/analyze-stock route (that uses analyst.ts).
export function computeQuantAnalysis(
  snapshot: MarketSnapshot | null
): MarketAnalysis {
  if (!snapshot) {
    return FALLBACK_ANALYSIS;
  }

  return {
    ...FALLBACK_ANALYSIS,
    summary: `Quant placeholder for ${snapshot.ticker}. Detailed scoring is handled by the main analyst engine.`,
    thesis:
      "This is a neutral, low-conviction placeholder from the library quant model.",
  };
}
