/**
 * Seed: one OWNER, the academy's five courses and their question banks. No
 * trainees, so the first trainee can be created by hand as an end-to-end test.
 *
 * Idempotent: courses are upserted by code, questions are matched on their exact
 * text, and re-running changes nothing that is already right. Any course outside
 * the five is switched off, never deleted, because it may hold enrolments.
 *
 * Re-seeding resets each of the five courses' fields (pass mark, attempts, exam
 * length, price, topics) to the values in prisma/seed-data/courses.ts.
 *
 * Run with: pnpm prisma db seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "../lib/auth/password";
import { cleanPng } from "../lib/signature/png";
import { COURSE_CODES, COURSES } from "./seed-data/courses";
import { loadQuestionBank } from "./seed-data/questions";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // absent — the guard below reports it
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local before seeding.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const OWNER_EMAIL = "gahiredev01@gmail.com";
const OWNER_NAME = "Academy Owner";

async function seedQuestions(courseId: string, code: string): Promise<{ added: number; total: number }> {
  const bank = loadQuestionBank(code);
  if (bank.length === 0) return { added: 0, total: 0 };

  const existing = await prisma.question.findMany({
    where: { courseId },
    select: { text: true, position: true },
  });
  const have = new Set(existing.map((q) => q.text));
  let position = existing.reduce((max, q) => Math.max(max, q.position), 0);

  let added = 0;
  for (const question of bank) {
    if (have.has(question.text)) continue;
    position += 1;
    await prisma.question.create({
      data: {
        courseId,
        text: question.text,
        position,
        difficulty: 2,
        isActive: true,
        options: {
          create: question.options.map((text, i) => ({
            text,
            position: i + 1,
            isCorrect: i === question.correctIndex,
          })),
        },
      },
    });
    added += 1;
  }
  return { added, total: bank.length };
}

async function main() {
  /* No default password: a credential in the source is a credential in the history. */
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      "SEED_OWNER_PASSWORD must be set to a password of at least 12 characters before seeding.",
    );
  }

  console.log("Seeding KSA data…");

  const passwordHash = await hashPassword(password);

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      name: OWNER_NAME,
      passwordHash,
      role: "OWNER",
      isActive: true,
      /* TOTP is not part of sign-in anymore (the second factor is an emailed
       * code from /login), so the owner never gets an authenticator secret. */
      totpEnabled: false,
      totpSecret: null,
      /* Re-seeding also unwinds any lockout left over from failed sign-ins. */
      failedLogins: 0,
      lockedAt: null,
    },
    create: {
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      passwordHash,
      role: "OWNER",
      isActive: true,
      totpEnabled: false,
    },
  });

  console.log(`  owner  ${owner.email} (password from SEED_OWNER_PASSWORD)`);

  /* No recovery codes here either: they are issued — and shown exactly once — by
   * POST /api/auth/mfa/confirm, which nothing calls until TOTP returns. */
  await prisma.recoveryCode.deleteMany({ where: { userId: owner.id } });

  /* A reseed is a fresh start: codes outstanding from an earlier attempt are
   * killed rather than left to expire, which also drops their attempt counter
   * and resend cooldowns. */
  const clearedOtps = await prisma.loginOtp.deleteMany({ where: { userId: owner.id } });
  if (clearedOtps.count > 0) {
    console.log(`  cleared ${clearedOtps.count} outstanding sign-in code(s)`);
  }

  const categoryByName = new Map<string, string>();
  for (const name of new Set(COURSES.map((c) => c.category))) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryByName.set(name, category.id);
  }
  console.log(`  categories: ${categoryByName.size}`);

  for (const course of COURSES) {
    const categoryId = categoryByName.get(course.category);
    if (!categoryId) throw new Error(`Unknown category: ${course.category}`);

    const data = {
      name: course.name,
      categoryId,
      description: course.description,
      topics: course.topics,
      durationValue: course.durationValue,
      durationUnit: course.durationUnit,
      priceRwf: course.priceRwf,
      passMarkPct: course.passMarkPct,
      maxAttempts: course.maxAttempts,
      validityMonths: course.validityMonths,
      examDurationMin: course.examDurationMin,
      isActive: true,
    };

    const row = await prisma.course.upsert({
      where: { code: course.code },
      update: data,
      create: { code: course.code, ...data },
    });

    const { added, total } = await seedQuestions(row.id, course.code);
    console.log(
      `  ${course.code.padEnd(9)} ${total === 0 ? "no question bank yet" : `${added} new of ${total} questions`}`,
    );
  }

  /* Anything else is retired from the UI but kept: it may hold enrolments. */
  const hidden = await prisma.course.updateMany({
    where: { code: { notIn: [...COURSE_CODES] }, isActive: true },
    data: { isActive: false },
  });
  if (hidden.count > 0) console.log(`  hid ${hidden.count} course(s) that are not one of the five`);

  /* Signature fallback: if no signature has ever been saved and the bundled
   * image exists, seed it as the active one so certificates keep printing it
   * until the owner draws their own. Never touches an existing signature. */
  if ((await prisma.signature.count()) === 0) {
    try {
      const cleaned = cleanPng(readFileSync(join(process.cwd(), "public", "certificate", "signature.png")));
      if (cleaned.ok) {
        const id = randomBytes(16).toString("hex");
        await prisma.signature.create({
          data: {
            id,
            imageKey: `db:${id}`,
            imageUrl: `/api/signature/${id}/image`,
            imageData: new Uint8Array(cleaned.data),
            signerName: "Fredson Niyoniringiye",
            signerTitle: "Director",
            source: "UPLOADED",
            isActive: true,
            lockedAt: new Date(),
            createdById: owner.id,
          },
        });
        console.log("  signature: seeded from public/certificate/signature.png");
      } else {
        console.log(`  signature: bundled image skipped (${cleaned.error})`);
      }
    } catch {
      console.log("  signature: no bundled image, skipped");
    }
  }

  const traineeCount = await prisma.trainee.count();
  console.log(`  trainees:  ${traineeCount} (left empty on purpose)`);
  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
