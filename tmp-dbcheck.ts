import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./lib/generated/prisma/client";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, totpEnabled: true, passwordHash: true },
  });

  console.log("users:", users.length);
  for (const u of users) {
    console.log(
      `  ${u.email} role=${u.role} totpEnabled=${u.totpEnabled} hashPrefix=${u.passwordHash.slice(0, 10)} hashLen=${u.passwordHash.length}`,
    );
  }

  console.log(
    "categories:", await prisma.category.count(),
    "courses:", await prisma.course.count(),
    "trainees:", await prisma.trainee.count(),
    "sessions:", await prisma.session.count(),
    "recoveryCodes:", await prisma.recoveryCode.count(),
  );

  const codes = await prisma.course.findMany({ select: { code: true }, orderBy: { code: "asc" } });
  console.log("course codes:", codes.map((c) => c.code).join(", "));
}

main()
  .finally(() => prisma.$disconnect());
