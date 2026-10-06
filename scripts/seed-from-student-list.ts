/**
 * Step 5 — bring the academy's real student numbers into the database.
 *
 * Source of truth: public/student/KIGALI SAFETY ACADEMY STUDENTS LIST.docx
 * (the Word table the academy sent). Each body row is:
 *
 *     <number> | <full name>
 *
 * and those numbers ARE the student numbers printed on certificates. This
 * script:
 *
 *   1. parses the .docx in-process (tiny ZIP/ECCD reader, no dependencies),
 *   2. normalizes names (Title-case display, trimmed, whitespace collapse,
 *      accent-stripped, order-insensitive middle-name key),
 *   3. skips annotations — "## the certificate was skipped", "(refer to N)",
 *      "-ID: ..." suffixes, stray fragments like "ane",
 *   4. creates one Trainee per register row (idempotent insert-only, keyed by
 *      traineeNo = the register number), NOT enrolled (courseId null),
 *   5. writes the name→number develop map for the API to
 *      scripts/student-list/student-numbers.json.
 *
 * A repeated name at a later number (a re-issue row such as "Ogabor Julius
 * Ineji" at 442 and 444) keeps the FIRST number and is logged as an alias, so
 * re-running stays idempotent. A number written against two different names
 * (74, 214, 231, 277) keeps whichever name survives both filters and logs the
 * sibling as a number collision — only one student exists per register number.
 *
 * Contact details do not exist in the register, so they are placeholders:
 * email student-<n>@register.example, phone +250000000000, countryCode
 * "Rwanda", category "Firefighters". The owner fills real data at
 * registration. Un-enrolled: courseId stays null.
 *
 * Usage:
 *   pnpm exec tsx scripts/seed-from-student-list.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // absent — the guard below reports it
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const REGISTER_PATH = join("public", "student", "KIGALI SAFETY ACADEMY STUDENTS LIST.docx");
const MANIFEST_PATH = join("scripts", "student-list", "student-numbers.json");
const PLACEHOLDER_CATEGORY = "Firefighters";

type RegisterRow = { number: number; name: string };
type Student = { number: number; name: string; key: string };

/* ---------------------------------------------------------------------------
 * Minimal .docx (ZIP) reader: locate word/document.xml through the central
 * directory, then inflate. Covers both stored and deflated entries.
 * ------------------------------------------------------------------------- */
function readDocxText(path: string): string {
  const raw = readFileSync(path);

  let eocd = -1;
  for (let i = raw.length - 22; i >= Math.max(0, raw.length - 0x10000); i -= 1) {
    if (raw.readUInt32LE(i) === 0x0605_4b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`Not a ZIP archive: ${path}`);

  const cdSize = raw.readUInt32LE(eocd + 12);
  const cdOffset = raw.readUInt32LE(eocd + 16);

  for (let p = cdOffset; p < cdOffset + cdSize; ) {
    if (raw.readUInt32LE(p) !== 0x0201_4b50) break;
    const method = raw.readUInt16LE(p + 10);
    const compSize = raw.readUInt32LE(p + 20);
    const nameLen = raw.readUInt16LE(p + 28);
    const extraLen = raw.readUInt16LE(p + 30);
    const commentLen = raw.readUInt16LE(p + 32);
    const localOffset = raw.readUInt32LE(p + 42);
    const name = raw.subarray(p + 46, p + 46 + nameLen).toString("utf8");

    if (name === "word/document.xml") {
      const localNameLen = raw.readUInt16LE(localOffset + 26);
      const localExtraLen = raw.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const payload = raw.subarray(start, start + compSize);
      const xml = method === 0 ? payload.toString("utf8") : inflateRawSync(payload).toString("utf8");
      return xml;
    }

    p += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error("word/document.xml not found in archive");
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/g, (m, name: string) => entities[name] ?? m);
}

function cellText(cellXml: string): string {
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(cellXml)) !== null) out += decodeXml(m[1]);
  /* Collapse any whitespace inside the cell, including non-breaking spaces
   * and line breaks Word inserts mid-name. */
  return out.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------------------------
 * Table walk: each <w:tr> → two <w:tc> cells (number, name-book title rows).
 * ------------------------------------------------------------------------- */
function parseRegister(xml: string): RegisterRow[] {
  const rows: RegisterRow[] = [];
  const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;

  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(xml)) !== null) {
    const cells: string[] = [];
    let tc: RegExpExecArray | null;
    while ((tc = tcRe.exec(tr[1])) !== null) cells.push(cellText(tc[1]));

    if (cells.length < 2) continue;
    const number = Number.parseInt(cells[0].trim(), 10);
    if (!Number.isFinite(number) || number <= 0) continue; // header rows
    rows.push({ number, name: cells[1] });
  }

  rows.sort((a, b) => a.number - b.number);
  return rows;
}

/* ---------------------------------------------------------------------------
 * Normalization. The key is lowercased, accent-stripped, punctuation dropped,
 * and word-sorted, so "Imbabazi Naomi" and "Naomi Imbabazi" collapse together.
 * ------------------------------------------------------------------------- */
function normalizeKey(name: string): string {
  const deaccented = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return deaccented
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

type Cleaned = { name: string; note: "student" | "skipped" | "alias" };

function cleanName(raw: string, anchor: { referTo?: number; reason?: string } = {}): Cleaned {
  let name = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  /* "#5 — the certificate was skipped" (annotation, not a student). */
  if (name.startsWith("##")) return { name: raw, note: "skipped" };

  /* "( refer to 238)" — a duplicate row pointing at the real number. */
  const refer = name.match(/\(?refer to\s+(\d+)\)?/i);
  if (refer) {
    anchor.referTo = Number.parseInt(refer[1], 10);
    return { name, note: "alias" };
  }

  /* "Ogwal Janan -ID:CM97005103W5KK" → strip the ID suffix. */
  name = name.replace(/\s+-ID:.*$/i, "").trim();

  /* "Nshimiyimana Valens-238(" → strip the trailing alias suffix. */
  name = name.replace(/-\d+\s*\(?$/i, "").trim().replace(/,$/, "").trim();

  /* Stray fragment such as "ane" left behind by a broken cell. Every real
   * name in the register is at least five letters, so a single short token
   * is a fragment. */
  if (!name.includes(" ") && name.length <= 4) {
    anchor.reason = `fragment: "${raw}"`;
    return { name, note: "skipped" };
  }

  return { name, note: "student" };
}

async function main() {
  const xml = readDocxText(REGISTER_PATH);
  const rows = parseRegister(xml);
  console.log(`  register   ${rows.length} numbered rows from ${REGISTER_PATH}`);

  /* Clean + dedupe. Two independent rules, applied in register order:
   *   - one student per number (a number that appears twice keeps the name
   *     that survives both filters; the sibling is logged as collision),
   *   - one number per name (a re-issue row such as "Ogabor Julius Ineji"
   *     at 442 and 444 keeps the first number; later ones are aliases).
   * Numbers come from the register itself, so absent rows (e.g. 42, 323-332)
   * stay unassigned on purpose. */
  const students: Student[] = [];
  const seenName = new Set<string>();
  const usedNumber = new Set<number>();
  const aliases: { number: number; name: string }[] = [];
  const numberCollisions: { number: number; name: string }[] = [];
  const skipped: { number: number; name: string }[] = [];
  const maxNumber =
    rows.reduce((max, r) => (r.number > max ? r.number : max), 0);

  for (const row of rows) {
    const anchor: { referTo?: number; reason?: string } = {};
    const cleaned = cleanName(row.name, anchor);

    if (cleaned.note === "skipped") {
      skipped.push({ number: row.number, name: cleaned.name });
      continue;
    }
    if (cleaned.note === "alias") {
      aliases.push({ number: row.number, name: cleaned.name });
      continue;
    }

    if (usedNumber.has(row.number)) {
      numberCollisions.push({ number: row.number, name: cleaned.name });
      continue;
    }

    const key = normalizeKey(cleaned.name);
    if (seenName.has(key)) {
      aliases.push({ number: row.number, name: cleaned.name });
      continue;
    }

    seenName.add(key);
    usedNumber.add(row.number);
    students.push({ number: row.number, name: cleaned.name, key });
  }

  for (const a of aliases) console.log(`  alias      #${a.number} -> "${a.name}" (kept first occurrence)`);
  for (const n of numberCollisions) console.log(`  collision  #${n.number} -> "${n.name}" (number already taken by a sibling row)`);
  for (const s of skipped) console.log(`  skipped    #${s.number} -> "${s.name}"`);

  const nextNumber = maxNumber + 1;
  console.log(`  students    ${students.length} unique`);
  console.log(`  register max ${maxNumber}  ->  next allocation ${nextNumber}`);

  /* Develop map for the API: plain register 1:1, then normalized for lookup. */
  const normalized: Record<string, { number: number; name: string }> = {};
  for (const s of students) normalized[s.key] = { number: s.number, name: s.name };

  /* A dedicated typed summary so product code (lib/certificates/issue.ts) can
   * start certificate numbers past the register without reading the 382-row
   * manifest or scanning the table. Regenerated on every run. */
  const summary =
    `/** Generated by scripts/seed-from-student-list.ts — do not edit. */\n` +
    `export const REGISTER_MAX_STUDENT_NUMBER = ${maxNumber};\n` +
    `export const REGISTER_NEXT_STUDENT_NUMBER = ${nextNumber};\n` +
    `export const REGISTER_SOURCE = ${JSON.stringify(REGISTER_PATH)};\n`;

  mkdirSync(join("scripts", "student-list"), { recursive: true });
  writeFileSync(join("scripts", "student-list", "register-numbers.ts"), summary, "utf8");

  const manifest = {
    source: "public/student/KIGALI SAFETY ACADEMY STUDENTS LIST.docx",
    updatedAt: new Date().toISOString(),
    maxStudentNumber: maxNumber,
    nextStudentNumber: nextNumber,
    counts: {
      registerRows: rows.length,
      uniqueStudents: students.length,
      aliases: aliases.length,
      numberCollisions: numberCollisions.length,
      skipped: skipped.length,
    },
    students: students.map((s) => ({
      number: s.number,
      name: s.name,
      normalized: s.key,
    })),
    collisions: numberCollisions.map((c) => ({ number: c.number, name: c.name })),
    normalizedByKey: normalized,
  };

  mkdirSync(join("scripts", "student-list"), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`  manifest   ${MANIFEST_PATH} (${students.length} students)`);

  /* Seed category so un-enrolled trainees always attach somewhere. */
  let category = await prisma.category.findUnique({ where: { name: PLACEHOLDER_CATEGORY } });
  if (!category) category = await prisma.category.create({ data: { name: PLACEHOLDER_CATEGORY } });

  /* Idempotent, insert-only batch: existing records are never overwritten, so
   * contacts the owner has filled in survive re-runs. createMany does the
   * whole batch in one round trip. */
  const studentNos = students.map((s) => String(s.number));
  const existing = await prisma.trainee.findMany({
    where: { traineeNo: { in: studentNos } },
    select: { traineeNo: true },
  });
  const existingNos = new Set(existing.map((t) => t.traineeNo));

  const toCreate = students
    .filter((s) => !existingNos.has(String(s.number)))
    .map((s) => ({
      traineeNo: String(s.number),
      fullName: s.name,
      email: `student-${s.number}@register.example`,
      phone: "+250000000000",
      countryCode: "Rwanda",
      categoryId: category.id,
      status: "PENDING" as const,
      paymentStatus: "UNPAID" as const,
      notes: `Imported from the academy register (#${s.number}). Placeholder contact; fill in at registration.`,
    }));

  if (toCreate.length > 0) {
    const created = await prisma.trainee.createMany({ data: toCreate, skipDuplicates: true });
    console.log(`  created    ${created.count} trainee(s) (courseId null — not enrolled)`);
  } else {
    console.log("  created    0 (register already seeded)");
  }

  /* Re-runs must converge: drop leftover placeholder rows this script created
   * for a register number that no longer resolves (e.g. a fragment like "ane"
   * that is now filtered out). Rows the owner has edited keep their new email
   * and are never touched. */
  const studentNumbers = new Set(students.map((s) => String(s.number)));
  const allTrainees = await prisma.trainee.findMany({
    select: { id: true, traineeNo: true, email: true },
  });
  let removed = 0;
  for (const t of allTrainees) {
    if (!/^\d+$/.test(t.traineeNo)) continue;
    if (studentNumbers.has(t.traineeNo)) continue;
    if (!/^student-\d+@register\.example$/.test(t.email)) continue;
    await prisma.trainee.delete({ where: { id: t.id } });
    removed += 1;
  }
  if (removed > 0) console.log(`  removed    ${removed} stale placeholder row(s)`);
  console.log(`  register   ${students.length} students in the database (courseId null — not enrolled)`);
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