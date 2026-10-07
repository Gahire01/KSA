/**
 * Phase 1 seed — one OWNER, six categories, eight courses. No trainees, so the
 * first trainee can be created by hand as an end-to-end test.
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
import type { DurationUnit } from "../lib/generated/prisma/client";

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
const DEFAULT_PASSWORD = "ChangeMe123!";

const CATEGORIES = [
  "Firefighters",
  "Maintenance",
  "First Aid",
  "Site Security",
  "Electrical Safety",
  "Working at Height",
] as const;

type SeedCourse = {
  code: string;
  name: string;
  category: (typeof CATEGORIES)[number];
  description: string;
  topics: string[];
  durationValue: number;
  durationUnit: DurationUnit;
  priceRwf: number;
  validityMonths: number | null;
  examDurationMin: number;
  isActive?: boolean;
};

/**
 * Mirrors the eight courses in the original `lib/mock/courses.ts` prototype so
 * the Phase 1 pages look the same, now backed by Postgres.
 */
const COURSES: SeedCourse[] = [
  {
    code: "FIRE",
    name: "Fire Safety Level 1",
    category: "Firefighters",
    description:
      "Foundational fire behaviour, classes of fire, extinguisher selection, evacuation procedure and hot-work permitting for site personnel.",
    topics: [
      "Fire Classes & Behavior",
      "Extinguisher Types & Use",
      "Evacuation Procedures",
      "Fire Prevention",
      "Emergency Response",
    ],
    durationValue: 3,
    durationUnit: "DAY",
    priceRwf: 120_000,
    validityMonths: null,
    examDurationMin: 45,
  },
  {
    code: "MAINT",
    name: "Mechanical Maintenance Safety",
    category: "Maintenance",
    description:
      "Machine guarding, lockout/tagout, hot work, pneumatic and hydraulic hazards, and safe isolation of industrial plant.",
    topics: [
      "Machine Guarding",
      "Lockout / Tagout",
      "Hot Work Permits",
      "Pneumatic & Hydraulic Hazards",
      "Safe Isolation of Plant",
    ],
    durationValue: 5,
    durationUnit: "DAY",
    priceRwf: 185_000,
    validityMonths: null,
    examDurationMin: 60,
  },
  {
    code: "FIRST",
    name: "First Aid & CPR",
    category: "First Aid",
    description:
      "Scene safety, primary survey, recovery position, CPR on adults and children, and treatment of bleeding, burns and shock.",
    topics: [
      "First Aid Principles",
      "CPR & AED",
      "Bleeding Control & Wound Care",
      "Fractures & Injuries",
      "Burns Management",
      "Emergency Response & Practical Assessments",
    ],
    durationValue: 2,
    durationUnit: "DAY",
    priceRwf: 85_000,
    validityMonths: null,
    examDurationMin: 30,
  },
  {
    code: "SITE",
    name: "Site Security & Access Control",
    category: "Site Security",
    description:
      "Access control procedure, visitor management, patrol discipline, incident reporting and radio discipline for site guards.",
    topics: [
      "Access Control Procedures",
      "Visitor Management",
      "Patrol Discipline",
      "Incident Reporting",
      "Radio Discipline",
    ],
    durationValue: 4,
    durationUnit: "WEEK",
    priceRwf: 65_000,
    validityMonths: null,
    examDurationMin: 40,
  },
  {
    code: "ELEC",
    name: "Electrical Safety (Low Voltage)",
    category: "Electrical Safety",
    description:
      "Electrical hazards, safe isolation and proving dead, arc-flash awareness, cable management and residual-current protection.",
    topics: [
      "Electrical Hazards & Effects of Shock",
      "Safe Isolation & Proving Dead",
      "Arc-Flash Awareness",
      "Cable Management",
      "Residual-Current Protection",
    ],
    durationValue: 5,
    durationUnit: "DAY",
    priceRwf: 210_000,
    validityMonths: null,
    examDurationMin: 60,
  },
  {
    code: "HEIGHT",
    name: "Working at Height",
    category: "Working at Height",
    description:
      "Fall prevention and protection, ladder and scaffold inspection, harness selection, anchor points and rescue planning.",
    topics: [
      "Fall Prevention & Protection",
      "Ladder Inspection & Safe Use",
      "Scaffold Inspection & Tagging",
      "Harness Selection & Fit",
      "Anchor Points & Tie-Off",
      "Rescue Planning",
    ],
    durationValue: 2,
    durationUnit: "DAY",
    priceRwf: 95_000,
    validityMonths: null,
    examDurationMin: 45,
  },
  {
    code: "CHEM",
    name: "Hazardous Chemicals & COSHH",
    category: "Maintenance",
    description:
      "Safety data sheets, exposure pathways, ventilation and respiratory protection, storage segregation and spill response.",
    topics: [
      "Safety Data Sheets (SDS)",
      "Exposure Pathways & Control",
      "Ventilation & Respiratory Protection",
      "Storage & Segregation",
      "Spill Response",
    ],
    durationValue: 1,
    durationUnit: "WEEK",
    priceRwf: 78_000,
    validityMonths: null,
    examDurationMin: 40,
    isActive: false,
  },
  {
    code: "DRIVE",
    name: "Safe Driving & Fleet Safety",
    category: "Site Security",
    description:
      "Defensive driving, load security, pre-trip inspection, fatigue management and incident response for fleet drivers.",
    topics: [
      "Defensive Driving Techniques",
      "Load Security",
      "Pre-Trip Vehicle Inspection",
      "Fatigue Management",
      "Incident Response",
    ],
    durationValue: 3,
    durationUnit: "DAY",
    priceRwf: 110_000,
    validityMonths: null,
    examDurationMin: 40,
  },
];

async function main() {
  const password = process.env.SEED_OWNER_PASSWORD ?? DEFAULT_PASSWORD;

  console.log("Seeding KSA Phase 1 data…");

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

  for (const name of CATEGORIES) {
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

    await prisma.course.upsert({
      where: { code: course.code },
      update: {
        name: course.name,
        categoryId,
        description: course.description,
        topics: course.topics,
        durationValue: course.durationValue,
        durationUnit: course.durationUnit,
        priceRwf: course.priceRwf,
        passMarkPct: 50,
        maxAttempts: 2,
        validityMonths: course.validityMonths,
        examDurationMin: course.examDurationMin,
        isActive: course.isActive ?? true,
      },
      create: {
        code: course.code,
        name: course.name,
        categoryId,
        description: course.description,
        topics: course.topics,
        durationValue: course.durationValue,
        durationUnit: course.durationUnit,
        priceRwf: course.priceRwf,
        passMarkPct: 50,
        maxAttempts: 2,
        validityMonths: course.validityMonths,
        examDurationMin: course.examDurationMin,
        isActive: course.isActive ?? true,
      },
    });
  }
  console.log(`  courses:   ${COURSES.length}`);

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
