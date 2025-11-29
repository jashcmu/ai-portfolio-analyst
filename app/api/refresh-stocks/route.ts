// app/api/refresh-stocks/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchYahooQuote } from "@/lib/fetchYahooRapid";
import {
  computeQuantAnalysis,
  type MarketAnalysis,
} from "@/lib/quantModel";

export async function POST() {
  try {
    // 1) Get all tickers from DB
    const allStocks = await prisma.stock.findMany({
      select: { id: true, ticker: true },
      orderBy: { id: "asc" },
    });

    if (allStocks.length === 0) {
      return NextResponse.json(
        { message: "No stocks in DB to refresh." },
        { status: 200 }
      );
    }

    const results: { ticker: string; ok: boolean; error?: string }[] = [];

    // 2) For each ticker, fetch new data + recompute scores
    for (const s of allStocks) {
      const ticker = s.ticker.toUpperCase();

      try {
        const snapshot = await fetchYahooQuote(ticker);

        if (!snapshot) {
          results.push({
            ticker,
            ok: false,
            error: "No snapshot from data providers",
          });
          continue;
        }

        const analysis: MarketAnalysis = computeQuantAnalysis(
          snapshot
        );

        const allFifty =
          analysis.toneScore === 50 &&
          analysis.growthScore === 50 &&
          analysis.profitabilityScore === 50 &&
          analysis.valuationScore === 50 &&
          analysis.balanceScore === 50 &&
          analysis.healthScore === 50;

        if (allFifty) {
          results.push({
            ticker,
            ok: false,
            error: "All scores 50 (insufficient data)",
          });
          continue;
        }

        await prisma.stock.update({
          where: { id: s.id },
          data: {
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

        results.push({ ticker, ok: true });
      } catch (err: any) {
        console.error("refresh-stocks: error for", ticker, err);
        results.push({
          ticker,
          ok: false,
          error: err?.message ?? "Unknown error",
        });
      }
    }

    // 3) Return summary
    return NextResponse.json(
      {
        refreshed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        details: results,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("refresh-stocks route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
