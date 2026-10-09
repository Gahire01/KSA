import { prisma } from "@/lib/db";
import { REGISTER_MAX_STUDENT_NUMBER } from "../../scripts/student-list/register-numbers";

/**
 * Next student number: plain digits, continuing from the highest number held
 * (never below the academy's register, whose last slot is 456, so the first new
 * trainee is 457). No prefix: this is also the number printed on the certificate.
 *
 * The maximum is taken numerically in SQL over the all-digit numbers only. A
 * string sort would rank "99" above "456", and a legacy "KSA-0001" above both.
 * Two simultaneous creates could pick the same number; the unique index then
 * rejects the loser, which the caller retries.
 */
export async function nextTraineeNo(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ highest: number | null }>>`
    SELECT MAX("traineeNo"::bigint)::int AS highest
    FROM "Trainee"
    WHERE "traineeNo" ~ '^[0-9]{1,9}$'
  `;

  const highest = Math.max(rows[0]?.highest ?? 0, REGISTER_MAX_STUDENT_NUMBER);
  return String(highest + 1);
}
