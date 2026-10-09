/**
 * Seed — one OWNER, the categories, and the five real courses the client
 * offers. No trainees, so the first trainee can be created by hand as an
 * end-to-end test.
 *
 * Courses are upserted by code, then any course whose code is not one of the
 * five real ones is deactivated. Re-seeding therefore replaces the mock
 * catalogue instead of stacking on top of it.
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

const CATEGORIES = [
  "Firefighters",
  "Maintenance",
  "First Aid",
  "Site Security",
  "Electrical Safety",
  "Working at Height",
  "Construction Safety",
  "Occupational Safety",
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
 * The five courses the client actually sells. Prices and tiers come from the
 * client's pricing sheet; the exam rules (60-minute paper, 50% pass, 2
 * attempts) apply to every course and are enforced by the academy-wide rules
 * in lib/exams/rules.ts.
 */
const COURSES: SeedCourse[] = [
  {
    code: "CONSTRUCT",
    name: "Construction Safety And Health Management",
    category: "Construction Safety",
    description:
      "The Construction Safety and Health Management course equips learners with essential skills to identify hazards, assess risks, and implement effective safety controls on construction sites. It focuses on accident prevention, safe work practices, use of PPE, and emergency preparedness, with the aim of strengthening workplace safety and promoting a strong safety culture in construction projects. In addition to classroom sessions, the course includes onsite learning through construction site visits, providing participants with practical exposure and real-life understanding of safety management in active project environments.",
    topics: [
      "Management Leadership",
      "Worker Participation",
      "Hazard Identification",
      "Risk Assessment",
      "Prevention and Control",
      "PPE and Safe Work Practices",
      "Emergency Preparedness",
      "Manhours & Incident Rates",
      "Site Induction",
      "Work at Height",
      "Housekeeping",
      "LTI and Incident Management",
      "General Construction Safety",
      "Onsite Practical Assessment",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 250_000,
    validityMonths: null,
    examDurationMin: 60,
  },
  {
    code: "OSH",
    name: "Occupational Safety and Health",
    category: "Occupational Safety",
    description:
      "Occupational Safety and Health (OSH) is the discipline concerned with protecting the safety, health, and welfare of workers in all workplaces by identifying hazards, assessing risks, and implementing effective preventive and control measures to reduce accidents, injuries, and occupational diseases. It promotes safe working practices, proper use of personal protective equipment, compliance with legal requirements, and continuous improvement of workplace safety systems to ensure a safe and healthy working environment for all employees.",
    topics: [
      "Hazard Identification",
      "Risk Assessment",
      "Preventive and Control Measures",
      "Personal Protective Equipment",
      "Legal Compliance",
      "Workplace Safety Systems",
      "Continuous Improvement",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 200_000,
    validityMonths: null,
    examDurationMin: 60,
  },
  {
    code: "FIRST",
    name: "First Aid",
    category: "First Aid",
    description:
      "First Aid training provides essential knowledge and practical skills to respond to medical emergencies in workplaces and everyday situations. It focuses on giving immediate care to an injured or suddenly ill person before professional medical help arrives, with the aim of preserving life, preventing the condition from worsening, and supporting recovery through basic emergency procedures such as wound care, bleeding control, and basic life support.",
    topics: [
      "First Aid Principles",
      "CPR & AED",
      "Bleeding Control & Wound Care",
      "Fractures & Injuries",
      "Burns Management",
      "Basic Life Support",
      "Emergency Response & Practical Assessments",
    ],
    durationValue: 1,
    durationUnit: "DAY",
    priceRwf: 40_000,
    validityMonths: null,
    examDurationMin: 60,
  },
  {
    code: "FIRE",
    name: "Fire Fighting Training",
    category: "Firefighters",
    description:
      "Fire Fighting training provides essential knowledge and practical skills to prevent, control, and respond to fire emergencies in the workplace and other environments. It focuses on understanding fire hazards, safe use of fire extinguishers, evacuation procedures, and emergency response techniques to protect lives, property, and the environment by ensuring timely and effective action during fire incidents.",
    topics: [
      "Fire Classes & Behavior",
      "Fire Hazards",
      "Extinguisher Types & Safe Use",
      "Evacuation Procedures",
      "Emergency Response Techniques",
      "Fire Prevention",
      "First Aid Response During Fire Emergencies",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 30_000,
    validityMonths: null,
    examDurationMin: 60,
  },
  {
    code: "RIGGER",
    name: "Rigger Safety Training",
    category: "Construction Safety",
    description:
      "Rigger Safety Training equips workers with the essential knowledge and practical skills required to plan and perform lifting operations safely. The course covers load assessment, selection and inspection of lifting equipment, sling angles and capacity, safe rigging techniques, use of tag lines, communication with crane operators, exclusion zones, and hazard control during lifting operations. It emphasizes planning, inspection, competent personnel, and keeping people clear of suspended loads to prevent serious injury or death.",
    topics: [
      "Lifting Plan and Load Assessment",
      "Sling Types and Inspection",
      "Sling Angles and Rated Capacity",
      "Rigging Techniques and Load Control",
      "Tag Lines and Communication",
      "Exclusion Zones and Line of Fire",
      "Crane Hand Signals",
      "Critical Lift Planning",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 40_000,
    validityMonths: null,
    examDurationMin: 60,
  },
];

async function main() {
  /* No fallback password: seeding without one would create a production owner with
   * a password that is written in this repository. Fail loudly instead. */
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      "SEED_OWNER_PASSWORD must be set to a password of at least 12 characters before seeding.",
    );
  }

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

  /* Any course whose code is not one of the five real ones is retired, so a
   * reseed can never leave a mock or deleted course silently on sale. */
  const activeCodes = new Set(COURSES.map((course) => course.code));
  const retired = await prisma.course.updateMany({
    where: { code: { notIn: [...activeCodes] } },
    data: { isActive: false },
  });
  if (retired.count > 0) {
    console.log(`  retired:   ${retired.count} course(s) no longer offered`);
  }

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
