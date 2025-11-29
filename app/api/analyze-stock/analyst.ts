// app/api/analyze-stock/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import {
  fetchYahooQuote,
  type MarketSnapshot,
} from "@/lib/fetchYahooRapid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type MarketAnalysis = {
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

const FALLBACK_ANALYSIS: MarketAnalysis = {
  rating: "HOLD",
  conviction: 50,
  toneScore: 50,
  growthScore: 50,
  profitabilityScore: 50,
  valuationScore: 50,
  balanceScore: 50,
  healthScore: 50,
  summary:
    "There was not enough reliable market data to provide a confident view. Treat this as a placeholder until more data is available.",
  keyRisks: ["Insufficient or low-quality market data."],
  thesis:
    "The model could not form a strong directional view based on the limited data, so a neutral hold stance is suggested.",
};

async function getAIAnalysis(snapshot: MarketSnapshot): Promise<MarketAnalysis> {
  const {
    ticker,
    companyName,
    price,
    marketCap,
    peRatio,
    change1d,
    change1m,
  } = snapshot;

  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set; using fallback analysis");
    return FALLBACK_ANALYSIS;
  }

  const userPrompt = `
You are an equity research analyst. You are given a market snapshot for a single stock.

Ticker: ${ticker}
Company: ${companyName ?? "N/A"}
Last price: ${price ?? "N/A"}
1-day change (%): ${change1d ?? "N/A"}
Approx. 52-week change proxy (%): ${change1m ?? "N/A"}
Market cap: ${marketCap ?? "N/A"}
P/E ratio (trailing/forward): ${peRatio ?? "N/A"}

TASK
----
Based ONLY on this snapshot (no external data, no internet), produce a short practical recommendation
for a retail investor.

Return a SINGLE JSON object with this exact shape:

{
  "rating": "BUY" | "HOLD" | "SELL",
  "conviction": number,          // 0-100
  "toneScore": number,           // 0-100
  "growthScore": number,         // 0-100
  "profitabilityScore": number,  // 0-100
  "valuationScore": number,      // 0-100 (higher = more attractive valuation),
  "balanceScore": number,        // 0-100 (risk/reward balance, 50 = neutral),
  "healthScore": number,         // 0-100 overall,
  "summary": string,             // 2-3 sentences,
  "keyRisks": string[],          // 3-6 short bullet points,
  "thesis": string               // 4-8 sentence deeper explanation
}

SCORING & RATING RULES
----------------------
- BUY: usually when
  - healthScore >= 65 AND
  - balanceScore >= 65 AND
  - conviction >= 60.
- SELL: usually when
  - healthScore <= 40 OR
  - balanceScore <= 40 OR
  - price action / valuation clearly suggest significant downside risk.
- HOLD for mixed or uncertain cases in between.

- valuationScore:
  - Higher if price and multiples look reasonable or cheap given recent moves.
  - Lower if valuation looks stretched given recent run-up or weak fundamentals.

OUTPUT RULES
------------
- Respond with STRICT JSON only. No markdown or commentary outside the JSON.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a disciplined buy-side equity analyst. When asked for JSON you MUST respond with valid JSON only.",
      },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  const text = raw && raw.trim().length > 0 ? raw : JSON.stringify(FALLBACK_ANALYSIS);

  try {
    return JSON.parse(text) as MarketAnalysis;
  } catch (err) {
    console.error("analyze-stock: Failed to parse AI JSON, using fallback", err, text);
    return FALLBACK_ANALYSIS;
  }
}

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

    // 1) Try Yahoo first
    let snapshot = await fetchYahooQuote(ticker);

    // 2) If Yahoo fails (quota, shape, etc.), fall back to a minimal snapshot
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
        marketCap: null,
        peRatio: null,
      };
    }

    // 3) Always ask OpenAI for a structured analysis
    const analysis = await getAIAnalysis(snapshot);

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

    // 5) Optional history logging
    try {
      await prisma.toneAnalysis.create({
        data: {
          stockId: stock.id,
          // quarter: "MARKET_SNAPSHOT", // only if your Prisma model has this column
          confidenceScore: analysis.conviction,
          finalToneScore: analysis.healthScore,
          summary: analysis.summary,
          recommendation: analysis.rating,
        },
      });
    } catch (e) {
      console.warn(
        "analyze-stock: Could not create ToneAnalysis entry (check Prisma schema)",
        e
      );
    }

    return NextResponse.json(
      {
        stock,
        snapshot,
        analysis,
        meta: {
          source: "market_snapshot_yahoo_or_fallback",
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
