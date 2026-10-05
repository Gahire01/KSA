import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Prisma 7 requires an explicit driver adapter.
 *
 * This module is imported from Next.js server code *and* from `prisma/seed.ts`,
 * which runs outside Next.js. Next.js loads `.env.local` for us, but a bare
 * `tsx` process does not — so load it defensively here.
 */
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // no .env.local — fall through to the guard below
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (gitignored) before using the database.",
  );
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Next.js dev hot-reload re-evaluates modules; without the global cache every
 * reload would open a fresh connection pool until Neon refuses more.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
