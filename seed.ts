// seed.ts (at project root)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.stock.deleteMany(); // clear old data (optional, safe)

  await prisma.stock.createMany({
    data: [
      {
        ticker: 'NVDA',
        company: 'NVIDIA Corporation',
        toneScore: 60,
        growthScore: 95,
        profitabilityScore: 88,
        valuationScore: 40,
        balanceScore: 70,
        healthScore: 85,
        rating: 'BUY',
        notes: 'High AI demand, export restriction risk.',
      },
      {
        ticker: 'AAPL',
        company: 'Apple Inc.',
        toneScore: 72,
        growthScore: 80,
        profitabilityScore: 90,
        valuationScore: 65,
        balanceScore: 75,
        healthScore: 88,
        rating: 'BUY',
        notes: 'Strong ecosystem, stable cash flows.',
      },
      {
        ticker: 'TSLA',
        company: 'Tesla, Inc.',
        toneScore: 65,
        growthScore: 92,
        profitabilityScore: 55,
        valuationScore: 45,
        balanceScore: 50,
        healthScore: 70,
        rating: 'HOLD',
        notes: 'High growth, volatile margins and valuation.',
      },
    ],
  });

  console.log('✅ Seeded NVDA, AAPL, TSLA');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
