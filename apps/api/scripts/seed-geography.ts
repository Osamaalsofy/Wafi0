import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedSaudiGeography } from '../src/geography/geography.seed.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('Missing required environment variable: DATABASE_URL');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  try {
    await seedSaudiGeography(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
