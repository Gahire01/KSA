-- Trainees that already carried an amount before the ledger existed get one opening-balance
-- receipt each, so Trainee.amountPaidRwf equals the sum of their Payment rows from day one
-- (otherwise the first new payment would recompute the total from rows and silently zero the
-- old balance). Idempotent: only trainees with money and no ledger rows are touched.
WITH todo AS (
  SELECT t.id, t."courseId", t."amountPaidRwf", t."createdAt",
         row_number() OVER (ORDER BY t."createdAt", t.id) AS rn
  FROM "Trainee" t
  WHERE t."amountPaidRwf" > 0
    AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."traineeId" = t.id)
),
base AS (
  SELECT COALESCE(MAX(substring("receiptNo" from '[0-9]+$')::int), 0) AS m
  FROM "Payment"
  WHERE "receiptNo" LIKE 'KSA-REC-' || to_char(now(), 'YYYY') || '-%'
)
INSERT INTO "Payment" ("id", "receiptNo", "traineeId", "courseId", "amountRwf", "method", "notes", "paidAt", "recordedByName")
SELECT 'mig_' || todo.id,
       'KSA-REC-' || to_char(now(), 'YYYY') || '-' || lpad((base.m + todo.rn)::text, 5, '0'),
       todo.id, todo."courseId", todo."amountPaidRwf", 'CASH',
       'Opening balance (carried over from the trainee record)', todo."createdAt", 'Migration'
FROM todo CROSS JOIN base;

-- The ledger must never be erased by deleting a trainee: refuse instead of cascading.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_traineeId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
