/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `confidence` on the `ToneAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ToneAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `finalTone` on the `ToneAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `growthOptimism` on the `ToneAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `uncertainty` on the `ToneAnalysis` table. All the data in the column will be lost.
  - Added the required column `confidenceScore` to the `ToneAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalToneScore` to the `ToneAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Stock" (
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
    "notes" TEXT
);
INSERT INTO "new_Stock" ("balanceScore", "company", "growthScore", "healthScore", "id", "notes", "profitabilityScore", "rating", "ticker", "toneScore", "valuationScore") SELECT "balanceScore", "company", "growthScore", "healthScore", "id", "notes", "profitabilityScore", "rating", "ticker", "toneScore", "valuationScore" FROM "Stock";
DROP TABLE "Stock";
ALTER TABLE "new_Stock" RENAME TO "Stock";
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");
CREATE TABLE "new_ToneAnalysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockId" INTEGER NOT NULL,
    "quarter" TEXT,
    "confidenceScore" INTEGER NOT NULL,
    "finalToneScore" INTEGER NOT NULL,
    "summary" TEXT,
    "recommendation" TEXT,
    CONSTRAINT "ToneAnalysis_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ToneAnalysis" ("id", "recommendation", "stockId", "summary") SELECT "id", "recommendation", "stockId", "summary" FROM "ToneAnalysis";
DROP TABLE "ToneAnalysis";
ALTER TABLE "new_ToneAnalysis" RENAME TO "ToneAnalysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
