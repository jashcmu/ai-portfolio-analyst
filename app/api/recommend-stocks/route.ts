// app/api/recommend-stocks/route.ts
// Risk-based stock recommendations from a curated universe,
// auto-analysed using the same quant model as /api/analyze-stock.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  fetchYahooQuote,
  type MarketSnapshot,
} from "@/lib/fetchYahooRapid";
import {
  computeQuantAnalysis,
  type MarketAnalysis,
} from "@/lib/quantModel";

type RiskProfile = "conservative" | "balanced" | "aggressive";

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
};

// Curated "market universe" – you can add/remove tickers as you like.
const POPULAR_TICKERS: string[] = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "BRK.B",
  "JPM",
  "V",
  "MA",
  "AVGO",
  "ADBE",
  "NFLX",
  "COST",
  "PEP",
  "KO",
  "WMT",
  "UNH",
  "LLY",
  "XOM",
  "CVX",
  "LIN",
  "ASML",
  "AMD",
  "INTC",
  "TGT",
  "DIS",
  "PYPL",
];

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 50;
}

function scoreForProfile(
  s: StockRecord,
  profile: RiskProfile
): number {
  const tone = n(s.toneScore);
  const growth = n(s.growthScore);
  const prof = n(s.profitabilityScore);
  const val = n(s.valuationScore);
  const bal = n(s.balanceScore);
  const health = n(s.healthScore);

  if (profile === "conservative") {
    return (
      health * 0.30 +
      bal * 0.30 +
      val * 0.20 +
      prof * 0.15 +
      growth * 0.05
    );
  }

  if (profile === "aggressive") {
    return (
      growth * 0.40 +
      tone * 0.20 +
      health * 0.15 +
      prof * 0.10 +
      val * 0.10 +
      bal * 0.05
    );
  }

  // balanced
  return (
    health * 0.25 +
    growth * 0.25 +
    bal * 0.20 +
    prof * 0.15 +
    val * 0.10 +
    tone * 0.05
  );
}

async function analyzeAndUpsertTicker(
  ticker: string
): Promise<void> {
  try {
    const snapshot = await fetchYahooQuote(ticker);
    if (!snapshot) {
      console.warn(
        "recommend-stocks: no snapshot for ticker",
        ticker
      );
      return;
    }

    const analysis: MarketAnalysis = computeQuantAnalysis(snapshot);

    const allFifty =
      analysis.toneScore === 50 &&
      analysis.growthScore === 50 &&
      analysis.profitabilityScore === 50 &&
      analysis.valuationScore === 50 &&
      analysis.balanceScore === 50 &&
      analysis.healthScore === 50;

    if (allFifty) {
      console.warn(
        "recommend-stocks: all scores 50 for",
        ticker,
        "- skipping upsert"
      );
      return;
    }

    const stock = await prisma.stock.upsert({
      where: { ticker },
      create: {
        ticker,
        company: snapshot.companyName ?? ticker,
        toneScore: analysis.toneScore,
        growthScore: analysis.growthScore,
        profitabilityScore: analysis.profitabilityScore,
        valuationScore: analysis.valuationScore,
        balanceScore: analysis.balanceScore,
        healthScore: analysis.healthScore,
        rating: analysis.rating,
        notes: analysis.summary,
      },
      update: {
        company: snapshot.companyName ?? ticker,
        toneScore: analysis.toneScore,
        growthScore: analysis.growthScore,
        profitabilityScore: analysis.profitabilityScore,
        valuationScore: analysis.valuationScore,
        balanceScore: analysis.balanceScore,
        healthScore: analysis.healthScore,
        rating: analysis.rating,
        notes: analysis.summary,
      },
    });

    try {
      await prisma.toneAnalysis.create({
        data: {
          stockId: stock.id,
          confidenceScore: analysis.conviction,
          finalToneScore: analysis.healthScore,
          summary: analysis.summary,
          recommendation: analysis.rating,
        },
      });
    } catch (e) {
      console.warn(
        "recommend-stocks: could not log ToneAnalysis for",
        ticker,
        e
      );
    }
  } catch (e) {
    console.warn(
      "recommend-stocks: analyzeAndUpsertTicker failed for",
      ticker,
      e
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawProfile =
      (url.searchParams.get("riskProfile") || "balanced").toLowerCase();
    const profile: RiskProfile =
      rawProfile === "conservative" ||
      rawProfile === "aggressive" ||
      rawProfile === "balanced"
        ? rawProfile
        : "balanced";

    const excludeRaw = (url.searchParams.get("exclude") ?? "").trim();
    const excludeSet = new Set(
      excludeRaw
        ? excludeRaw
            .split(",")
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)
        : []
    );

    // 1) Choose candidate universe (curated tickers minus excluded)
    const candidateTickers = POPULAR_TICKERS.filter(
      (t) => !excludeSet.has(t.toUpperCase())
    );

    if (candidateTickers.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // 2) Fetch existing scores for these tickers
    const existing = (await prisma.stock.findMany({
      where: { ticker: { in: candidateTickers } },
    })) as StockRecord[];

    const existingSet = new Set(existing.map((s) => s.ticker.toUpperCase()));

    // 3) For missing tickers, lazily analyse a few (to avoid hammering APIs)
    const missing = candidateTickers.filter(
      (t) => !existingSet.has(t.toUpperCase())
    );

    const MAX_NEW_ANALYSES = 8; // safety limit per request
    const toAnalyze = missing.slice(0, MAX_NEW_ANALYSES);

    for (const ticker of toAnalyze) {
      await analyzeAndUpsertTicker(ticker);
    }

    // 4) Re-fetch updated pool
    const stocks = (await prisma.stock.findMany({
      where: { ticker: { in: candidateTickers } },
    })) as StockRecord[];

    const filtered = stocks.filter((s) => s.healthScore != null);

    const scored = filtered
      .map((s) => ({
        ...s,
        profileScore: scoreForProfile(s, profile),
      }))
      .sort((a, b) => b.profileScore - a.profileScore)
      .slice(0, 8);

    return NextResponse.json(
      scored.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        company: s.company,
        rating: s.rating,
        toneScore: s.toneScore,
        growthScore: s.growthScore,
        profitabilityScore: s.profitabilityScore,
        valuationScore: s.valuationScore,
        balanceScore: s.balanceScore,
        healthScore: s.healthScore,
        profileScore: Math.round(s.profileScore),
      })),
      { status: 200 }
    );
  } catch (e: any) {
    console.error("recommend-stocks route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
