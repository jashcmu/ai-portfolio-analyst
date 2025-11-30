// app/api/analyze-transcript/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";

type TranscriptAnalysis = {
  toneScore: number;
  growthScore: number;
  profitabilityScore: number;
  valuationScore: number;
  balanceScore: number;
  healthScore: number;
  summary: string;
  keyPoints: string[];
  recommendation: "BUY" | "HOLD" | "SELL";
};

const FALLBACK_TRANSCRIPT_ANALYSIS: TranscriptAnalysis = {
  toneScore: 50,
  growthScore: 50,
  profitabilityScore: 50,
  valuationScore: 50,
  balanceScore: 50,
  healthScore: 50,
  summary:
    "We could not perform a detailed transcript analysis because the AI model was not available. Treat this as a placeholder.",
  keyPoints: [],
  recommendation: "HOLD",
};

// --- SAFE, LAZY OPENAI CLIENT ------------------------------------------

let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      "OPENAI_API_KEY is not set. Transcript analysis route will return a fallback result."
    );
    return null;
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

// --- CORE ANALYSIS FUNCTION ---------------------------------------------

async function getTranscriptAnalysis(
  ticker: string,
  quarter: string,
  transcript: string
): Promise<TranscriptAnalysis> {
  const client = getOpenAIClient();

  // If no key / client, never throw – just return fallback
  if (!client) {
    return FALLBACK_TRANSCRIPT_ANALYSIS;
  }

  const prompt = `
You are an equity analyst reviewing an earnings call transcript.

Ticker: ${ticker}
Quarter / Event: ${quarter}

TRANSCRIPT (may be truncated):
"""
${transcript.slice(0, 8000)}
"""

Return a SINGLE JSON object:

{
  "toneScore": number,          // 0-100
  "growthScore": number,        // 0-100
  "profitabilityScore": number, // 0-100
  "valuationScore": number,     // 0-100
  "balanceScore": number,       // 0-100 (risk/reward)
  "healthScore": number,        // 0-100 overall
  "summary": string,            // 3-5 sentences in plain English
  "keyPoints": string[],        // 4-8 bullet-style strings
  "recommendation": "BUY" | "HOLD" | "SELL"
}

SCORING / RATING HINTS
----------------------
- BUY if tone, growth, and health are strong with manageable risks.
- SELL if tone/health indicate significant deterioration or major red flags.
- HOLD for mixed or unclear messaging.

OUTPUT: strict JSON only, no commentary.
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a disciplined equity analyst. Respond ONLY with valid JSON when asked.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    const text =
      raw && raw.trim().length > 0
        ? raw
        : JSON.stringify(FALLBACK_TRANSCRIPT_ANALYSIS);

    return JSON.parse(text) as TranscriptAnalysis;
  } catch (err) {
    console.error(
      "analyze-transcript: OpenAI call failed, using fallback",
      err
    );
    return FALLBACK_TRANSCRIPT_ANALYSIS;
  }
}

// --- ROUTE HANDLER ------------------------------------------------------

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      ticker?: string;
      quarter?: string;
      transcript?: string;
    };

    const ticker = (body.ticker ?? "").toString().trim().toUpperCase();
    const quarter = (body.quarter ?? "").toString().trim() || "UNKNOWN";
    const transcript = (body.transcript ?? "").toString().trim();

    if (!ticker || !transcript) {
      return NextResponse.json(
        { error: "ticker and transcript are required" },
        { status: 400 }
      );
    }

    const analysis = await getTranscriptAnalysis(
      ticker,
      quarter,
      transcript
    );

    // Store last analysis in DB (best effort)
    try {
      const stock = await prisma.stock.upsert({
        where: { ticker },
        create: {
          ticker,
          company: ticker,
          healthScore: analysis.healthScore,
          toneScore: analysis.toneScore,
          growthScore: analysis.growthScore,
          profitabilityScore: analysis.profitabilityScore,
          valuationScore: analysis.valuationScore,
          balanceScore: analysis.balanceScore,
          rating: analysis.recommendation,
          notes: analysis.summary,
        },
        update: {
          healthScore: analysis.healthScore,
          toneScore: analysis.toneScore,
          growthScore: analysis.growthScore,
          profitabilityScore: analysis.profitabilityScore,
          valuationScore: analysis.valuationScore,
          balanceScore: analysis.balanceScore,
          rating: analysis.recommendation,
          notes: analysis.summary,
        },
      });

      await prisma.toneAnalysis.create({
        data: {
          stockId: stock.id,
          confidenceScore: analysis.healthScore,
          finalToneScore: analysis.healthScore,
          summary: analysis.summary,
          recommendation: analysis.recommendation,
        },
      });
    } catch (e) {
      console.warn(
        "analyze-transcript: failed to store analysis in DB",
        e
      );
    }

    return NextResponse.json(
      {
        ticker,
        quarter,
        analysis,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("analyze-transcript route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
