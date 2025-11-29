// app/api/analyze-stock/route.ts
// Multi-factor model using Yahoo (quote + financial-data) + FMP (ratios-ttm)

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

const FALLBACK_ANALYSIS: MarketAnalysis = {
  rating: "HOLD",
  conviction: 40,
  toneScore: 50,
  growthScore: 50,
  profitabilityScore: 50,
  valuationScore: 50,
  balanceScore: 50,
  healthScore: 50,
  summary:
    "We could not compute a full multi-factor score because key data was missing. Treat this as a neutral placeholder.",
  keyRisks: ["Insufficient or inconsistent data for robust scoring."],
  thesis:
    "Data gaps prevent a clear directional view. Consider supplementing this with manual research.",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { ticker?: string };
    const ticker = (body.ticker ?? "").toString().trim().toUpperCase();

    if (!ticker) {
      return NextResponse.json(
        { error: "ticker is required" },
        { status: 400 }
      );
    }

    // 1) Fetch combined snapshot (Yahoo + FMP)
    let snapshot = await fetchYahooQuote(ticker);

    if (!snapshot) {
      console.warn(
        "analyze-stock: snapshot missing, using minimal placeholder for",
        ticker
      );
      snapshot = {
        ticker,
        companyName: ticker,
        price: null,
        prevClose: null,
        dayHigh: null,
        dayLow: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        volume: null,
        avgVolume3m: null,
        change1dPct: null,
        changeFrom52wLowPct: null,
        changeFrom52wHighPct: null,
        fiftyTwoWeekChangePct: null,
        marketCap: null,
        peRatio: null,
        pegRatio: null,
        priceToSales: null,
        priceToBook: null,
        profitMargin: null,
        roe: null,
        revenueGrowth: null,
        epsGrowth: null,
        beta: null,
      } satisfies MarketSnapshot;
    }

    console.log("analyze-stock snapshot:", snapshot);

    // 2) Deterministic quant scores
    const analysis = computeQuantAnalysis(snapshot);

    const allFifty =
      analysis.toneScore === 50 &&
      analysis.growthScore === 50 &&
      analysis.profitabilityScore === 50 &&
      analysis.valuationScore === 50 &&
      analysis.balanceScore === 50 &&
      analysis.healthScore === 50;

    const final = allFifty ? FALLBACK_ANALYSIS : analysis;

    // 3) Upsert into DB
    const stock = await prisma.stock.upsert({
      where: { ticker },
      create: {
        ticker,
        company: snapshot.companyName ?? ticker,
        toneScore: final.toneScore,
        growthScore: final.growthScore,
        profitabilityScore: final.profitabilityScore,
        valuationScore: final.valuationScore,
        balanceScore: final.balanceScore,
        healthScore: final.healthScore,
        rating: final.rating,
        notes: final.summary,
      },
      update: {
        company: snapshot.companyName ?? ticker,
        toneScore: final.toneScore,
        growthScore: final.growthScore,
        profitabilityScore: final.profitabilityScore,
        valuationScore: final.valuationScore,
        balanceScore: final.balanceScore,
        healthScore: final.healthScore,
        rating: final.rating,
        notes: final.summary,
      },
    });

    // 4) Optional history logging
    try {
      await prisma.toneAnalysis.create({
        data: {
          stockId: stock.id,
          confidenceScore: final.conviction,
          finalToneScore: final.healthScore,
          summary: final.summary,
          recommendation: final.rating,
        },
      });
    } catch (e) {
      console.warn(
        "analyze-stock: could not create ToneAnalysis entry",
        e
      );
    }

    return NextResponse.json(
      {
        stock,
        snapshot,
        analysis: final,
        meta: {
          source: "yahoo_quote + yahoo_financial_data + fmp_ratios_ttm",
          usesFundamentals: true,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("analyze-stock route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
