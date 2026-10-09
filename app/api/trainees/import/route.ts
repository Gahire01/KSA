import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { actorOf, audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseCsv } from "@/lib/exams/import";
import { recordPayment } from "@/lib/payments/ledger";
import { nextTraineeNo } from "@/lib/trainees/number";

/**
 * POST /api/trainees/import { text, mode: "preview" | "commit" }
 *
 * Bulk enrolment from a CSV: name, email, phone, country, category, course and an
 * optional amountPaid. `preview` validates and reports every row's problems and
 * writes nothing; `commit` creates the valid rows (an amountPaid becomes a payment
 * in the ledger). The course may be its code or its name, the category its name.
 * A row is rejected, never guessed at.
 */

const bodySchema = z
  .object({
    text: z.string().max(MAX_IMPORT_BYTES, "That file is too large."),
    mode: z.enum(["preview", "commit"]),
  })
  .strict();

const REQUIRED = ["name", "email", "course"] as const;
const PHONE = /^\+?\d[\d\s]{6,}$/;
const EMAIL = z.string().email();

interface RowResult {
  row: number;
  values: Record<string, string>;
  errors: string[];
  status: "valid" | "error";
}

const clean = (v: string | undefined) => (v ?? "").trim();

export async function POST(request: Request) {
  const gate = await guard("trainee.create");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const table = parseCsv(parsed.data.text).filter((cells) => cells.some((c) => c.trim() !== ""));
  if (table.length < 2) return apiFail("The file needs a header row and at least one trainee.", 422);
  if (table.length - 1 > MAX_IMPORT_ROWS) return apiFail(`At most ${MAX_IMPORT_ROWS} rows per import.`, 422);

  const headers = (table[0] as string[]).map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, ""));
  const missing = REQUIRED.filter((h) => !headers.includes(h));
  if (missing.length > 0) return apiFail(`Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`, 422);

  const [courses, categories, existing] = await Promise.all([
    prisma.course.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, categoryId: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.trainee.findMany({ select: { email: true } }),
  ]);
  const takenEmails = new Set(existing.map((t) => t.email.toLowerCase()));
  const seenInFile = new Set<string>();

  const results: Array<RowResult & { create?: { fullName: string; email: string; phone: string; countryCode: string; categoryId: string; courseId: string; amount: number } }> =
    table.slice(1).map((cells, i) => {
      const values: Record<string, string> = {};
      headers.forEach((h, k) => {
        values[h] = clean(cells[k]);
      });
      const errors: string[] = [];

      const fullName = values.name ?? "";
      if (fullName.length < 3) errors.push("Enter the full name (at least 3 characters).");

      const email = (values.email ?? "").toLowerCase();
      if (!EMAIL.safeParse(email).success) errors.push("Enter a valid email address.");
      else if (takenEmails.has(email)) errors.push("A trainee with that email already exists.");
      else if (seenInFile.has(email)) errors.push("This email appears twice in the file.");
      seenInFile.add(email);

      const phone = values.phone ?? "";
      if (!PHONE.test(phone)) errors.push("Phone: use digits, spaces and an optional leading +.");

      const key = (values.course ?? "").toLowerCase();
      const course = courses.find((c) => c.code.toLowerCase() === key || c.name.toLowerCase() === key);
      if (!course) errors.push(`Unknown course "${values.course ?? ""}". Use a course code or name.`);

      const categoryKey = (values.category ?? "").toLowerCase();
      const category = categoryKey
        ? categories.find((c) => c.name.toLowerCase() === categoryKey)
        : course
          ? categories.find((c) => c.id === course.categoryId)
          : undefined;
      if (!category) errors.push(categoryKey ? `Unknown category "${values.category}".` : "Choose a category.");

      const amountText = values.amountpaid ?? "";
      if (!/^\d{0,9}$/.test(amountText)) errors.push("amountPaid must be digits only.");

      const country = values.country || "Rwanda";

      return {
        row: i + 2,
        values,
        errors,
        status: errors.length === 0 ? ("valid" as const) : ("error" as const),
        create:
          errors.length === 0 && course && category
            ? { fullName, email, phone, countryCode: country, categoryId: category.id, courseId: course.id, amount: Number(amountText || 0) }
            : undefined,
      };
    });

  const valid = results.filter((r) => r.status === "valid");
  const summary = {
    total: results.length,
    valid: valid.length,
    invalid: results.length - valid.length,
    rows: results.slice(0, 300).map((r) => ({ row: r.row, values: r.values, errors: r.errors, status: r.status })),
    rowsTruncated: results.length > 300,
  };

  if (parsed.data.mode === "preview") return apiOk(summary);
  if (valid.length === 0) return apiFail("There are no valid rows to import.", 422);

  const recorder = { id: gate.session.user.id, name: gate.session.user.name ?? gate.session.user.email };
  let imported = 0;
  for (const row of valid) {
    const data = row.create!;
    /* A concurrent create can claim the same number; the unique index rejects the loser, so retry. */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const trainee = await prisma.trainee.create({
          data: {
            traineeNo: await nextTraineeNo(),
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            countryCode: data.countryCode,
            categoryId: data.categoryId,
            courseId: data.courseId,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (data.amount > 0) {
          await prisma.$transaction((tx) =>
            recordPayment(tx, {
              traineeId: trainee.id,
              amountRwf: data.amount,
              method: "CASH",
              notes: "Paid at enrolment (import)",
              recorder,
            }),
          );
        }
        imported += 1;
        break;
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "P2002" || attempt === 2) {
          console.error("[trainee-import] row failed", error);
          break;
        }
      }
    }
  }

  await audit({
    ...actorOf(gate.session),
    action: "trainee.import",
    entityType: "Trainee",
    meta: { imported, skipped: results.length - imported },
  });

  return apiOk({ ...summary, imported }, 201);
}
