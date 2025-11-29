// app/api/compare-stocks/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("tickers") ?? "").trim();

    if (!raw) {
      return NextResponse.json([], { status: 200 });
    }

    const tickers = Array.from(
      new Set(
        raw
          .split(",")
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    if (tickers.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const stocks = await prisma.stock.findMany({
      where: { ticker: { in: tickers } },
      orderBy: { ticker: "asc" },
    });

    return NextResponse.json(stocks, { status: 200 });
  } catch (e: any) {
    console.error("compare-stocks route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
