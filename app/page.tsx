// app/page.tsx
import prisma from "@/lib/prisma";
import StockSearch from "@/components/StockSearch";
import Link from "next/link";

export default async function HomePage() {
  // Try to load some stocks from your database (top by healthScore)
  let stocks: any[] = [];
  try {
    stocks = await prisma.stock.findMany({
      orderBy: { healthScore: "desc" },
      take: 6,
    });
  } catch (e) {
    console.error("Error loading stocks from Prisma:", e);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        {/* Hero */}
        <section className="rounded-3xl bg-gradient-to-r from-sky-700 to-indigo-700 px-8 py-8 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-100/80">
            AI Portfolio Analyst
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Analyze Stocks with AI, in Plain English
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-sky-100/90">
            Search a ticker, run an AI-powered analysis, and see a simple
            buy/hold/sell-style view of the company&apos;s health.
          </p>

          <div className="mt-6">
            <StockSearch />
          </div>
        </section>

        {/* Recommended / saved stocks */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Saved / Recommended Stocks
            </h2>
            <p className="text-xs text-slate-500">
              These are pulled from your database (top by health score).
            </p>
          </div>

          {stocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-5 text-sm text-slate-600">
              No stocks saved yet. Search for a ticker above, run an analysis on
              its page, and it will start showing up here.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {stocks.map((stock) => (
                <article
                  key={stock.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          {stock.ticker}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {stock.company}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase text-slate-500">
                          Health
                        </p>
                        <p className="text-xl font-bold text-emerald-600">
                          {stock.healthScore}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Rating: {stock.rating}
                        </p>
                      </div>
                    </div>
                    {stock.notes && (
                      <p className="mt-2 line-clamp-3 text-xs text-slate-600">
                        {stock.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <Link
                      href={`/stocks/${stock.ticker}`}
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      View details →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Analyze transcript link */}
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Want to analyze an earnings call transcript?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Go to the transcript tool to paste a call and generate tone scores
            and a recommendation.
          </p>
          <Link
            href="/analyze-transcript"
            className="mt-3 inline-flex text-xs font-semibold text-sky-700 hover:underline"
          >
            Analyze a transcript →
          </Link>
        </section>
      </div>
    </main>
  );
}

