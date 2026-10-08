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


/**
 * `prisma generate` (run by postinstall and by `build`) writes the client from the
 * schema alone and never opens a connection, so it must not need a database URL: a
 * fresh install or a CI/Vercel build step without the variable would otherwise fail
 * here and leave `lib/generated/prisma` missing, which is what breaks `next build`
 * with "Can't resolve '@/lib/generated/prisma/client'". Commands that do connect
 * still insist on a real URL.
 */
const needsDatabase = process.argv.some((arg) => ["migrate", "db", "studio"].includes(arg));
const url = process.env["DATABASE_URL"] ?? "";

if (!url && needsDatabase) {
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
