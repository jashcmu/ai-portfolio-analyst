// app/api/search-stocks/route.ts
// GET /api/search-stocks?query=...

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type StockSearchResult = {
  ticker: string;
  company: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("query") ?? "").trim();

  // No query -> empty list
  if (!q) {
    return NextResponse.json([], { status: 200 });
  }

  // Search in ticker OR company (no `mode` here to avoid Prisma type issues)
  const results: StockSearchResult[] = await prisma.stock.findMany({
    where: {
      OR: [
        { ticker: { contains: q } },
        { company: { contains: q } },
      ],
    },
    take: 10,
    orderBy: { ticker: "asc" },
    select: {
      ticker: true,
      company: true,
    },
  });

  // ⬇️ IMPORTANT: we explicitly type `s` so TS cannot complain
  const payload = results.map((s: StockSearchResult) => ({
    ticker: s.ticker,
    company: s.company,
  }));

  return NextResponse.json(payload, { status: 200 });
}
