-- CreateTable
CREATE TABLE "Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticker" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "toneScore" INTEGER NOT NULL,
    "growthScore" INTEGER NOT NULL,
    "profitabilityScore" INTEGER NOT NULL,
    "valuationScore" INTEGER NOT NULL,
    "balanceScore" INTEGER NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "rating" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ToneAnalysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockId" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "growthOptimism" INTEGER NOT NULL,
    "uncertainty" INTEGER NOT NULL,
    "finalTone" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToneAnalysis_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");
