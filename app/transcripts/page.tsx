// app/page.tsx
import prisma from "@/lib/prisma";
import StockSearch from "@/components/StockSearch";
import Link from "next/link";

export default async function HomePage() {
  // Load stocks from your Prisma DB
  const stocks = await prisma.stock.findMany({
    orderBy: { healthScore: "desc" },
    take: 6, // show top 6
  });

  return (
    <div className="space-y-10">
      {/* HERO SECTION */}
      <section className="rounded-3xl bg-gradient-to-r from-sky-700 to-indigo-700 px-8 py-10 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-100/80">
          AI PORTFOLIO ANALYST
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Your Portfolio Intelligence Hub
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-sky-100/90">
          Data-driven insights, sentiment analysis, and personalized
          recommendations at your fingertips.
        </p>
      </section>

      {/* 🔍 SEARCH BAR SECTION */}
      <section>
        <StockSearch />
      </section>

      {/* ⭐ PORTFOLIO RECOMMENDATIONS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Portfolio Recommendations
          </h2>
          <Link
            href="/stocks"
            className="text-xs font-semibold text-sky-700 hover:underline"
          >
            View All
          </Link>
        </div>

        {stocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No stocks in your database yet. Analyze a transcript (NVDA, AAPL,
            TSLA, etc.) and recommendations will appear here.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {stocks.map((stock: any) => (
              <article
                key={stock.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Recommended Stock
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                      {stock.ticker}{" "}
                      <span className="text-slate-500 font-normal">
                        • {stock.company}
                      </span>
                    </h3>

                    {stock.notes && (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-3">
                        {stock.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500">
                      Health Score
                    </p>
                    <p className="text-xl font-bold text-emerald-500">
                      {stock.healthScore}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tone + growth + risk
                    </p>
                  </div>
                </div>

                {/* Scores grid */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Tone</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stock.toneScore}/100
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Growth</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stock.growthScore}/100
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Profitability</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stock.profitabilityScore}/100
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Valuation</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stock.valuationScore}/100
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Balance</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stock.balanceScore}/100
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Rating</p>
                    <p className="mt-1 text-sm font-semibold">
                      {stock.rating}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <Link
                    href={`/stocks/${stock.ticker}`}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    View full analysis →
                  </Link>
                  <div className="space-x-2">
                    <button className="rounded-full bg-sky-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-800">
                      Add to Portfolio
                    </button>
                    <button className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 📊 RECENT SENTIMENT PLACEHOLDER */}
      <section className="space-y-3 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Sentiment & Transcripts
          </h2>
          <Link
            href="/analyze-transcript"
            className="text-xs font-semibold text-sky-700 hover:underline"
          >
            Analyze a new earnings call →
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          Soon this section will show all your recent transcript analyses (NVDA
          Q3, AAPL Q4, etc.) pulled from your ToneAnalysis history table.
        </p>
      </section>
    </div>
  );
}
