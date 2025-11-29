// lib/marketData.ts
// Fetches fundamental data for a single ticker from yahoo-finance15 (RapidAPI)

export type MarketSnapshot = {
  ticker: string;
  companyName: string;
  price: number | null;
  targetPrice: number | null;
  pe: number | null;
  peg: number | null;
  dividendYield: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  beta: number | null;
};

function readNum(value: any): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "object") {
    if ("raw" in value && typeof (value as any).raw === "number") {
      return Number.isFinite((value as any).raw) ? (value as any).raw : null;
    }
    if ("fmt" in value) {
      const n = Number((value as any).fmt.toString().replace(/[%,$]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
  }

  const n = Number(String(value).replace(/[%,$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function fetchMarketSnapshot(
  symbol: string
): Promise<MarketSnapshot | null> {
  const apiKey = process.env.YF_RAPIDAPI_KEY;
  if (!apiKey) {
    console.error("YF_RAPIDAPI_KEY is not set in .env.local");
    return null;
  }

  const url = `https://yahoo-finance15.p.rapidapi.com/api/yahoo/qu/quote/${encodeURIComponent(
    symbol
  )}/financial-data`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "yahoo-finance15.p.rapidapi.com",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Yahoo Finance API error", res.status, text);
    return null;
  }

  const json = await res.json();

  const fd = json?.financialData ?? json;
  const priceBlock = json?.price ?? {};

  const snapshot: MarketSnapshot = {
    ticker: symbol,
    companyName:
      priceBlock.shortName ||
      priceBlock.longName ||
      json?.quoteType?.shortName ||
      symbol,
    price: readNum(fd.currentPrice),
    targetPrice: readNum(fd.targetMeanPrice),
    pe: readNum(fd.trailingPE ?? fd.forwardPE),
    peg: readNum(fd.pegRatio),
    dividendYield: readNum(fd.dividendYield),
    profitMargin: readNum(fd.profitMargins),
    revenueGrowth: readNum(fd.revenueGrowth),
    earningsGrowth: readNum(fd.earningsGrowth),
    debtToEquity: readNum(fd.debtToEquity),
    beta: readNum(fd.beta),
  };

  return snapshot;
}
