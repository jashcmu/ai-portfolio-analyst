// lib/data.ts

export type Rating = 'BUY' | 'HOLD' | 'SELL';

export interface ToneEngine {
  confidence: number;
  growthOptimism: number;
  uncertainty: number;
  finalTone: number;
}

export interface Stock {
  ticker: string;
  company: string;
  toneScore: number;
  growthScore: number;
  profitabilityScore: number;
  valuationScore: number;
  balanceScore: number;
  healthScore: number;
  rating: Rating;
  notes: string;
  tone?: ToneEngine;
}

// simple in-memory "database"
export const STOCKS: Stock[] = [
  {
    ticker: 'NVDA',
    company: 'NVIDIA Corporation',
    toneScore: 60,
    growthScore: 95,
    profitabilityScore: 88,
    valuationScore: 40,
    balanceScore: 70,
    healthScore: Math.round(
      0.30 * 95 + 0.25 * 88 + 0.15 * 40 + 0.15 * 60
    ),
    rating: 'BUY',
    notes: 'Demand > supply; record DC revenue; China risk.',
    tone: {
      confidence: 92,
      growthOptimism: 95,
      uncertainty: 18,
      finalTone: 60,
    },
  },
];

export function getAllStocks() {
  return STOCKS;
}

export function getStockByTicker(ticker: string | undefined) {
  if (!ticker) return null;

  const lower = ticker.toLowerCase();
  return STOCKS.find((s) => s.ticker.toLowerCase() === lower) ?? null;
}
