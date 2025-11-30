// app/api/analyze-stock/route.ts
// Route: POST /api/analyze-stock
// Uses Yahoo/FMP data + quant model (no OpenAI) to score a single stock
// and upsert it into the Prisma Stock table.

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  fetchYahooQuote,
  type MarketSnapshot,
} from "@/lib/fetchYahooRapid";
import {
  computeQuantAnalysis,
  FALLBACK_ANALYSIS,
  type MarketAnalysis,
} from "./analyst";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      ticker?: string;
    };

    const ticker = (body.ticker ?? "").toString().trim().toUpperCase();

    if (!ticker) {
      return NextResponse.json(
        { error: "ticker is required" },
        { status: 400 }
      );
    }

    // 1) Try to get a live snapshot from Yahoo
    let snapshot: MarketSnapshot | null = await fetchYahooQuote(
      ticker
    );

    // 2) Fallback minimal snapshot if Yahoo fails
    if (!snapshot) {
      console.warn(
        "analyze-stock: Yahoo snapshot missing, falling back to minimal snapshot for",
        ticker
      );

      snapshot = {
        ticker,
        companyName: ticker,
        price: null,
        change1d: null,
        change1m: null,
        changeFrom52wLowPct: null,
        changeFrom52wHighPct: null,
        marketCap: null,
        peRatio: null,
      };
    }

    // 3) Run the quant model to get scores
    const analysis: MarketAnalysis = computeQuantAnalysis(snapshot);

    // 4) Upsert into Stock table
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

    // 5) Optional: store a toneAnalysis history row
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
        "analyze-stock: Could not create ToneAnalysis entry",
        e
      );
    }

    return NextResponse.json(
      {
        stock,
        snapshot,
        analysis,
        meta: {
          source: "quant_model_yahoo_or_fallback",
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
