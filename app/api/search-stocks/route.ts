import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json([], { status: 200 });
  }

  const results = await prisma.stock.findMany({
    where: {
      OR: [
        { ticker: { contains: q } },    // no "mode" for sqlite
        { company: { contains: q } },
      ],
    },
    take: 10,
    orderBy: { ticker: "asc" },
  });

  return NextResponse.json(
    results.map((s) => ({
      ticker: s.ticker,
      company: s.company,
    })),
    { status: 200 }
  );
}
