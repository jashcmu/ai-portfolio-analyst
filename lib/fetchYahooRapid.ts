// lib/fetchYahooRapid.ts
// Helper to fetch a quote snapshot from Yahoo Finance (RapidAPI)
// and normalise it into a MarketSnapshot object.

// lib/fetchYahooRapid.ts
// Helper to fetch a quote snapshot from Yahoo Finance (RapidAPI)
// and normalise it into a MarketSnapshot object.

export type MarketSnapshot = {
  ticker: string;
  companyName: string | null;
  price: number | null;
  change1d: number | null;            // 1-day % change
  change1m: number | null;            // 1-month / 30-day % change (best-effort proxy)
  changeFrom52wLowPct: number | null; // distance from 52w low in %
  changeFrom52wHighPct: number | null;// distance from 52w high in %
  marketCap: number | null;
  peRatio: number | null;

  // 🔽 Extra fundamentals used by quantModel.ts (all optional)
  priceToSales?: number | null;
  priceToBook?: number | null;
  pegRatio?: number | null;
  roe?: number | null;
  netMargin?: number | null;
  revenueGrowth1y?: number | null;
  epsGrowth1y?: number | null;
  debtToEquity?: number | null;
  dividendYield?: number | null;
};


const DEFAULT_HOST = "yahoo-finance15.p.rapidapi.com";

export async function fetchYahooQuote(
  symbol: string
): Promise<MarketSnapshot | null> {
  const apiKey = process.env.YF_RAPIDAPI_KEY;
  const host = process.env.YF_RAPIDAPI_HOST || DEFAULT_HOST;

  if (!apiKey) {
    console.warn("YF_RAPIDAPI_KEY is not set in environment");
    return null;
  }

  if (!symbol) return null;

  const url = `https://${host}/api/yahoo/qu/quote/${encodeURIComponent(
    symbol
  )}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      console.error(
        "fetchYahooQuote: Yahoo API error",
        res.status,
        res.statusText,
        text.slice(0, 200)
      );
      return null;
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.error(
        "fetchYahooQuote: response was not valid JSON",
        err,
        text.slice(0, 200)
      );
      return null;
    }

    // Normalise different response shapes
    let quote: any = null;
    if (Array.isArray(json)) {
      quote = json[0];
    } else if (json && typeof json === "object") {
      if (Array.isArray(json.data)) {
        quote = json.data[0];
      } else if (Array.isArray(json.result)) {
        quote = json.result[0];
      } else if (
        json.quoteResponse &&
        Array.isArray(json.quoteResponse.result)
      ) {
        quote = json.quoteResponse.result[0];
      } else {
        quote = json;
      }
    }

    if (!quote || !quote.symbol) {
      console.error("fetchYahooQuote: unexpected JSON shape", json);
      return null;
    }

    const price =
      typeof quote.regularMarketPrice === "number"
        ? quote.regularMarketPrice
        : null;

    const oneDayChangePct =
      typeof quote.regularMarketChangePercent === "number"
        ? quote.regularMarketChangePercent
        : null;

    // If the API doesn’t give a clean 1-month change, use 52-week change as a rough proxy
    const oneMonthProxy =
      typeof quote.fiftyTwoWeekChange === "number"
        ? quote.fiftyTwoWeekChange
        : null;

    const low52 =
      typeof quote.fiftyTwoWeekLow === "number"
        ? quote.fiftyTwoWeekLow
        : null;
    const high52 =
      typeof quote.fiftyTwoWeekHigh === "number"
        ? quote.fiftyTwoWeekHigh
        : null;

    let changeFrom52wLowPct: number | null = null;
    let changeFrom52wHighPct: number | null = null;

    if (price != null && low52 != null && low52 > 0) {
      changeFrom52wLowPct = ((price - low52) / low52) * 100;
    }
    if (price != null && high52 != null && high52 > 0) {
      changeFrom52wHighPct = ((price - high52) / high52) * 100;
    }

    const marketCap =
      typeof quote.marketCap === "number" ? quote.marketCap : null;

    const peRatio =
      typeof quote.trailingPE === "number"
        ? quote.trailingPE
        : typeof quote.forwardPE === "number"
        ? quote.forwardPE
        : null;

    return {
      ticker: quote.symbol,
      companyName: quote.longName ?? quote.shortName ?? quote.symbol,
      price,
      change1d: oneDayChangePct,
      change1m: oneMonthProxy,
      changeFrom52wLowPct,
      changeFrom52wHighPct,
      marketCap,
      peRatio,
    };
  } catch (err) {
    console.error("fetchYahooQuote: network/fetch error", err);
    return null;
  }
}

export const fetchYahooRapid = fetchYahooQuote;

