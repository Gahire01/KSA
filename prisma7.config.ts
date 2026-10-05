import { defineConfig } from "prisma/config";

/**
 * Prisma's CLI does NOT read `.env.local` on its own (Next.js does, at runtime).
 * We keep a single source of truth in `.env.local`, so load it here explicitly.
 * `.env` is only a fallback for CI-style setups.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file absent — ignore
  }
}


const url = process.env["DATABASE_URL"];

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (gitignored) before running Prisma.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url,
  },
});
