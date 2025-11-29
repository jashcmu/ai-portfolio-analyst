// lib/fetchYahooRapid.ts
// Combined Yahoo Finance (RapidAPI) + FinancialModelingPrep fundamentals helper

export type MarketSnapshot = {
  ticker: string;
  companyName: string | null;

  // Price & trading
  price: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;

  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;

  volume: number | null;
  avgVolume3m: number | null;

  // Returns / distances (percent, e.g. 15 = +15%)
  change1dPct: number | null;           // 1-day % move
  changeFrom52wLowPct: number | null;   // % above 52w low
  changeFrom52wHighPct: number | null;  // % vs 52w high (negative = below)
  fiftyTwoWeekChangePct: number | null; // 52w % change

  // Valuation
  marketCap: number | null;
  peRatio: number | null;
  pegRatio: number | null;
  priceToSales: number | null;
  priceToBook: number | null;

  // Fundamentals (fractions: 0.25 = 25%)
  profitMargin: number | null;   // net profit margin
  roe: number | null;            // return on equity
  revenueGrowth: number | null;  // revenue growth
  epsGrowth: number | null;      // EPS / earnings growth

  // Risk
  beta: number | null;
};

const DEFAULT_HOST = "yahoo-finance15.p.rapidapi.com";

function toNumber(val: any): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Recursively search for an object that looks like a Yahoo "quote" node. */
function findQuoteNode(obj: any): any | null {
  if (!obj || typeof obj !== "object") return null;

  const hasSymbol =
    typeof obj.symbol === "string" || typeof obj.ticker === "string";
  const hasMarketField =
    "regularMarketPrice" in obj ||
    "marketCap" in obj ||
    "fiftyTwoWeekHigh" in obj ||
    "fiftyTwoWeekLow" in obj;

  if (hasSymbol && hasMarketField) return obj;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findQuoteNode(item);
      if (found) return found;
    }
    return null;
  }

  for (const key of Object.keys(obj)) {
    const found = findQuoteNode(obj[key]);
    if (found) return found;
  }

  return null;
}

/** Handle both raw numbers and { raw: number } style fields. */
function getRawNumber(field: any): number | null {
  if (field == null) return null;
  if (typeof field === "number" && Number.isFinite(field)) return field;
  if (typeof field === "object" && typeof field.raw === "number") {
    return Number.isFinite(field.raw) ? field.raw : null;
  }
  return null;
}

/* ---------------- FMP enrichment (fills whatever Yahoo missed) ---------------- */

async function enrichWithFmp(
  symbol: string,
  base: MarketSnapshot
): Promise<MarketSnapshot> {
  const apiKey = process.env.FMP_API_KEY;
  const baseUrl =
    process.env.FMP_BASE_URL || "https://financialmodelingprep.com";

  if (!apiKey) {
    console.warn("FMP_API_KEY missing – skipping FMP enrichment");
    return base;
  }

  // Newer "stable" endpoint, matches official docs:
  // https://financialmodelingprep.com/stable/ratios-ttm?symbol=AAPL&apikey=...
  const url = `${baseUrl}/stable/ratios-ttm?symbol=${encodeURIComponent(
    symbol
  )}&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      console.warn(
        "enrichWithFmp: FMP ratios-ttm error",
        res.status,
        res.statusText,
        text.slice(0, 200)
      );
      return base;
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.warn(
        "enrichWithFmp: FMP response not JSON",
        err,
        text.slice(0, 200)
      );
      return base;
    }

    const row = Array.isArray(json) ? json[0] : json;
    if (!row || typeof row !== "object") {
      console.warn("enrichWithFmp: unexpected FMP JSON shape", json);
      return base;
    }

    // Legacy/typical field names in FMP ratios-ttm:
    // netProfitMarginTTM, roeTTM, revenueGrowthTTM, epsGrowthTTM (may or may not all exist)
    const profitMarginTTM = toNumber(row.netProfitMarginTTM);
    const roeTTM = toNumber(row.roeTTM);
    const revenueGrowthTTM = toNumber(row.revenueGrowthTTM);
    const epsGrowthTTM = toNumber(row.epsGrowthTTM);

    const merged: MarketSnapshot = {
      ...base,
      profitMargin:
        base.profitMargin != null ? base.profitMargin : profitMarginTTM,
      roe: base.roe != null ? base.roe : roeTTM,
      revenueGrowth:
        base.revenueGrowth != null
          ? base.revenueGrowth
          : revenueGrowthTTM,
      epsGrowth:
        base.epsGrowth != null ? base.epsGrowth : epsGrowthTTM,
    };

    console.log("enrichWithFmp merged fundamentals:", {
      fromYahoo: {
        profitMargin: base.profitMargin,
        roe: base.roe,
        revenueGrowth: base.revenueGrowth,
        epsGrowth: base.epsGrowth,
      },
      fromFmp: {
        profitMarginTTM,
        roeTTM,
        revenueGrowthTTM,
        epsGrowthTTM,
      },
      final: {
        profitMargin: merged.profitMargin,
        roe: merged.roe,
        revenueGrowth: merged.revenueGrowth,
        epsGrowth: merged.epsGrowth,
      },
    });

    return merged;
  } catch (err) {
    console.warn("enrichWithFmp: network error", err);
    return base;
  }
}

/* ---------------- Yahoo quote + financial-data ---------------- */

export async function fetchYahooQuote(
  symbol: string
): Promise<MarketSnapshot | null> {
  const apiKey = process.env.YF_RAPIDAPI_KEY;
  const host = process.env.YF_RAPIDAPI_HOST || DEFAULT_HOST;

  if (!apiKey) {
    console.warn("YF_RAPIDAPI_KEY is not set in .env.local");
    return null;
  }
  if (!symbol) return null;

  const baseUrl = `https://${host}/api/yahoo/qu/quote/${encodeURIComponent(
    symbol
  )}`;

  try {
    // 1) Core quote
    const quoteRes = await fetch(baseUrl, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
      },
      cache: "no-store",
    });

    const quoteText = await quoteRes.text();

    if (!quoteRes.ok) {
      console.error(
        "fetchYahooQuote: quote API error",
        quoteRes.status,
        quoteRes.statusText,
        quoteText.slice(0, 200)
      );
      return null;
    }

    let quoteJson: any;
    try {
      quoteJson = JSON.parse(quoteText);
    } catch (err) {
      console.error(
        "fetchYahooQuote: quote response not valid JSON",
        err,
        quoteText.slice(0, 200)
      );
      return null;
    }

    const quote = findQuoteNode(quoteJson);
    if (!quote) {
      console.error(
        "fetchYahooQuote: could not find quote node",
        JSON.stringify(quoteJson).slice(0, 400)
      );
      return null;
    }

    const price =
      typeof quote.regularMarketPrice === "number"
        ? quote.regularMarketPrice
        : null;
    const prevClose =
      typeof quote.regularMarketPreviousClose === "number"
        ? quote.regularMarketPreviousClose
        : null;

    let change1dPct: number | null = null;
    if (typeof quote.regularMarketChangePercent === "number") {
      change1dPct = quote.regularMarketChangePercent;
    } else if (price != null && prevClose != null && prevClose !== 0) {
      change1dPct = ((price - prevClose) / prevClose) * 100;
    }

    const fiftyTwoWeekHigh =
      typeof quote.fiftyTwoWeekHigh === "number"
        ? quote.fiftyTwoWeekHigh
        : null;
    const fiftyTwoWeekLow =
      typeof quote.fiftyTwoWeekLow === "number"
        ? quote.fiftyTwoWeekLow
        : null;

    let changeFrom52wLowPct: number | null = null;
    let changeFrom52wHighPct: number | null = null;

    if (
      price != null &&
      fiftyTwoWeekLow != null &&
      fiftyTwoWeekLow !== 0
    ) {
      changeFrom52wLowPct =
        ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100;
    }

    if (
      price != null &&
      fiftyTwoWeekHigh != null &&
      fiftyTwoWeekHigh !== 0
    ) {
      changeFrom52wHighPct =
        ((price - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100;
    }

    const fiftyTwoWeekChangePct =
      typeof quote.fiftyTwoWeekChange === "number"
        ? quote.fiftyTwoWeekChange * 100
        : typeof quote["52WeekChange"] === "number"
        ? quote["52WeekChange"] * 100
        : null;

    const volume =
      typeof quote.regularMarketVolume === "number"
        ? quote.regularMarketVolume
        : null;
    const avgVolume3m =
      typeof quote.averageDailyVolume3Month === "number"
        ? quote.averageDailyVolume3Month
        : null;

    const marketCap =
      typeof quote.marketCap === "number" ? quote.marketCap : null;

    const peRatio =
      typeof quote.trailingPE === "number"
        ? quote.trailingPE
        : typeof quote.forwardPE === "number"
        ? quote.forwardPE
        : null;

    const priceToSales =
      typeof quote.priceToSalesTrailing12Months === "number"
        ? quote.priceToSalesTrailing12Months
        : null;

    const priceToBook =
      typeof quote.priceToBook === "number" ? quote.priceToBook : null;

    const pegRatio =
      typeof quote.pegRatio === "number" ? quote.pegRatio : null;

    const beta =
      typeof quote.beta === "number" ? quote.beta : null;

    let snapshot: MarketSnapshot = {
      ticker: quote.symbol ?? quote.ticker ?? symbol,
      companyName: quote.longName ?? quote.shortName ?? symbol,

      price,
      prevClose,
      dayHigh:
        typeof quote.regularMarketDayHigh === "number"
          ? quote.regularMarketDayHigh
          : null,
      dayLow:
        typeof quote.regularMarketDayLow === "number"
          ? quote.regularMarketDayLow
          : null,

      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,

      volume,
      avgVolume3m,

      change1dPct,
      changeFrom52wLowPct,
      changeFrom52wHighPct,
      fiftyTwoWeekChangePct,

      marketCap,
      peRatio,
      pegRatio,
      priceToSales,
      priceToBook,

      profitMargin: null,
      roe: null,
      revenueGrowth: null,
      epsGrowth: null,

      beta,
    };

    // 2) Yahoo financial-data: try to fill fundamentals from Yahoo first
    try {
      const finRes = await fetch(`${baseUrl}/financial-data`, {
        method: "GET",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
        },
        cache: "no-store",
      });

      const finText = await finRes.text();

      if (!finRes.ok) {
        console.warn(
          "fetchYahooQuote: financial-data API error",
          finRes.status,
          finRes.statusText,
          finText.slice(0, 200)
        );
      } else {
        try {
          const finJson = JSON.parse(finText);
          const fd = finJson.financialData;

          if (fd && typeof fd === "object") {
            const profitMargins = getRawNumber(fd.profitMargins);
            const returnOnEquity = getRawNumber(fd.returnOnEquity);
            const revenueGrowth = getRawNumber(fd.revenueGrowth);
            const earningsGrowth = getRawNumber(fd.earningsGrowth);
            const pegFromFd = getRawNumber(fd.pegRatio);
            const psFromFd = getRawNumber(
              fd.priceToSalesTrailing12Months
            );
            const pbFromFd = getRawNumber(fd.priceToBook);

            snapshot = {
              ...snapshot,
              profitMargin: profitMargins ?? snapshot.profitMargin,
              roe: returnOnEquity ?? snapshot.roe,
              revenueGrowth: revenueGrowth ?? snapshot.revenueGrowth,
              epsGrowth: earningsGrowth ?? snapshot.epsGrowth,
              pegRatio: pegFromFd ?? snapshot.pegRatio,
              priceToSales: psFromFd ?? snapshot.priceToSales,
              priceToBook: pbFromFd ?? snapshot.priceToBook,
            };
          } else {
            console.warn(
              "fetchYahooQuote: financialData field missing in JSON"
            );
          }
        } catch (err) {
          console.warn(
            "fetchYahooQuote: failed to parse financial-data JSON",
            err,
            finText.slice(0, 200)
          );
        }
      }
    } catch (err) {
      console.warn("fetchYahooQuote: financial-data fetch error", err);
    }

    // 3) FMP enrichment: fill any remaining null fundamentals (profitMargin, ROE, growth)
    const enriched = await enrichWithFmp(symbol, snapshot);

    console.log("fetchYahooQuote final snapshot:", enriched);
    return enriched;
  } catch (err) {
    console.error("fetchYahooQuote: network/fetch error", err);
    return null;
  }
}

// Alias for earlier imports
export const fetchYahooRapid = fetchYahooQuote;
