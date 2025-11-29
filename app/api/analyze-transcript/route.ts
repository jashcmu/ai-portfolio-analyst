// app/api/analyze-transcript/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TranscriptAnalysis = {
  rating: "BUY" | "HOLD" | "SELL";
  conviction: number; // 0–100
  toneScore: number; // 0–100
  growthScore: number; // 0–100
  profitabilityScore: number; // 0–100
  valuationScore: number; // 0–100
  balanceScore: number; // 0–100 (risk / reward balance)
  healthScore: number; // 0–100 overall
  summary: string;
  keyRisks: string[];
  thesis: string;
};

const FALLBACK_ANALYSIS: TranscriptAnalysis = {
  rating: "HOLD",
  conviction: 50,
  toneScore: 50,
  growthScore: 50,
  profitabilityScore: 50,
  valuationScore: 50,
  balanceScore: 50,
  healthScore: 50,
  summary:
    "There was not enough reliable information to form a strong view. Treat this as a placeholder until more data is available.",
  keyRisks: [],
  thesis:
    "The model could not produce a valid structured response, so this is a neutral fallback stance with no strong buy or sell conviction.",
};

async function getAIAnalysis(input: {
  ticker: string;
  quarter?: string;
  transcript: string;
}): Promise<TranscriptAnalysis> {
  const { ticker, quarter, transcript } = input;

  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set; returning fallback analysis");
    return FALLBACK_ANALYSIS;
  }

  // Avoid sending huge transcripts (hard limit to keep prompt size under control)
  const clippedTranscript =
    transcript.length > 16000
      ? transcript.slice(0, 16000) + "\n\n[Transcript truncated for length]"
      : transcript;

  const userPrompt = `
You are a buy-side equity research analyst focused on earnings call transcripts.

You are analysing the transcript for ${ticker}${
    quarter ? ` for the period "${quarter}"` : ""
  }.

TRANSCRIPT
---------
"""${clippedTranscript}"""

TASK
----
1. Carefully read the transcript and infer:
   - Management tone (confidence, transparency, body language hints, if any).
   - Growth outlook (revenue trends, product pipeline, TAM, competitive position).
   - Profitability trajectory (margin trends, cost discipline, operating leverage).
   - Valuation risk (are expectations implied by the call too high or too low?).
   - Balance of risks vs opportunities (macro, competition, execution).

2. Then produce a single JSON object that fits this exact TypeScript type:

{
  "rating": "BUY" | "HOLD" | "SELL",
  "conviction": number,          // 0-100 (below 40 = weak, 40-70 = medium, 70+ = strong)
  "toneScore": number,           // 0-100
  "growthScore": number,         // 0-100
  "profitabilityScore": number,  // 0-100
  "valuationScore": number,      // 0-100 (higher = more attractive valuation vs what the call implies)
  "balanceScore": number,        // 0-100 (50 = balanced, >50 more upside than downside)
  "healthScore": number,         // 0-100 overall business health & execution risk
  "summary": string,             // 2-4 sentence plain-English summary
  "keyRisks": string[],          // 3-6 bullet-style risks
  "thesis": string               // 4-8 sentence deeper investment thesis
}

SCORING CONSISTENCY RULES
-------------------------
- BUY normally means:
  - healthScore >= 60 AND
  - balanceScore >= 60 AND
  - conviction >= 55.
- SELL normally means:
  - healthScore <= 45 OR
  - balanceScore <= 40 OR
  - clearly negative tone/profitability signals.
- HOLD is for mixed / uncertain cases in between.
- Do NOT output BUY if the transcript sounds clearly negative or highly uncertain.
- Do NOT output SELL if the transcript sounds clearly strong with low risk.

OUTPUT RULES
------------
- Return STRICT JSON only. No markdown, no comments, no explanations outside the JSON.
- All numbers must be between 0 and 100.

Return ONLY that JSON object.`;

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
    const parsed = JSON.parse(text) as TranscriptAnalysis;
    return parsed;
  } catch (err) {
    console.error("analyze-transcript: Failed to parse AI JSON, using fallback", err, text);
    return FALLBACK_ANALYSIS;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      ticker?: string;
      quarter?: string;
      transcript?: string;
      company?: string;
    };

    const ticker = (body.ticker ?? "").toString().trim().toUpperCase();
    const transcript = (body.transcript ?? "").toString().trim();
    const quarter = body.quarter ? String(body.quarter) : undefined;

    if (!ticker || !transcript) {
      return NextResponse.json(
        { error: "ticker and transcript are required" },
        { status: 400 }
      );
    }

    const analysis = await getAIAnalysis({ ticker, quarter, transcript });

    // Upsert into Stock table
    const stock = await prisma.stock.upsert({
      where: { ticker },
      create: {
        ticker,
        company: body.company ?? ticker,
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

    // Log a ToneAnalysis row.
    // ⚠ If your Prisma model *does* have a `quarter` field, you can uncomment it.
    try {
      await prisma.toneAnalysis.create({
        data: {
          stockId: stock.id,
          // quarter: quarter ?? "TRANSCRIPT",
          confidenceScore: analysis.conviction,
          finalToneScore: analysis.healthScore,
          summary: analysis.summary,
          recommendation: analysis.rating,
        },
      });
    } catch (e) {
      console.warn(
        "analyze-transcript: Could not create ToneAnalysis entry (check Prisma schema)",
        e
      );
    }

    return NextResponse.json(
      {
        stock,
        analysis,
        meta: {
          source: "earnings_transcript",
          quarter: quarter ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("analyze-transcript route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected server error in /api/analyze-transcript" },
      { status: 500 }
    );
  }
}
