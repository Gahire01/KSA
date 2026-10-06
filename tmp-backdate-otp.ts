/**
 * Test helper: move the owner's outstanding sign-in codes into the past so
 * expiry can be exercised without sitting out the full 10 minutes.
 *
 * Touches expiresAt only — the row, its attempts and the code itself stay as
 * the server wrote them, so /api/auth/login/verify takes exactly the same path
 * it would after 11 real minutes.
 *
 * Run: npx tsx tmp-backdate-otp.ts [email] [seconds]
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./lib/generated/prisma/client";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // absent — reported below
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const email = process.argv[2] ?? "gahiredev01@gmail.com";
const seconds = Number(process.argv[3] ?? 60);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const updated = await prisma.loginOtp.updateMany({
    where: { user: { email } },
    data: { expiresAt: new Date(Date.now() - seconds * 1000) },
  });

  console.log(`backdated ${updated.count} LoginOtp row(s) for ${email} to -${seconds}s`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
