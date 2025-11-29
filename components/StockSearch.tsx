"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StockSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const clean = query.trim().toUpperCase();
    if (!clean) return;

    // ⭐ THIS IS THE ONLY IMPORTANT PART ⭐
    // It sends the user to `/stocks/AAPL`
    router.push(`/stocks/${encodeURIComponent(clean)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input
        type="text"
        value={query}
        placeholder="Search by ticker (AAPL, NVDA, TSLA...)"
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      <button
        type="submit"
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
      >
        Go
      </button>
    </form>
  );
}
