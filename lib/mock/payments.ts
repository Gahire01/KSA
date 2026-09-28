import { subDays } from "date-fns";

import { generateReceiptNo, seededFromString } from "@/lib/utils/ids";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/types";
import { MOCK_NOW, courseById } from "./courses";
import { trainees } from "./trainees";
import { trainers } from "./trainers";

const METHODS: PaymentMethod[] = ["MOMO", "MOMO", "BANK", "BANK", "CASH", "CARD"];

const STATUS_PLAN: PaymentStatus[] = [
  ...Array<PaymentStatus>(48).fill("PAID"),
  ...Array<PaymentStatus>(18).fill("PARTIAL"),
  ...Array<PaymentStatus>(10).fill("UNPAID"),
  ...Array<PaymentStatus>(4).fill("PAID"),
];

const RECORDER_IDS = ["usr_admin", "usr_admin", "usr_admin", "usr_owner", "usr_front"];

const RECORDER_NAMES: Record<string, string> = {
  usr_admin: "Sandrine Uwimana",
  usr_owner: "Aline Mukamana",
  usr_front: "Front desk — Solange I.",
};

const REFERENCE_PREFIX: Record<PaymentMethod, string> = {
  MOMO: "MM",
  BANK: "BNK",
  CASH: "CSH",
  CARD: "CRD",
};

function buildPayments(): Payment[] {
  const rnd = seededFromString("ksa-payments-v1");
  const out: Payment[] = [];

  for (let i = 0; i < 80; i += 1) {
    const trainee = trainees[i % trainees.length] as (typeof trainees)[number];
    const course = courseById.get(trainee.courseId);
    const price = course?.priceRwf ?? 100_000;
    const status = STATUS_PLAN[i] as PaymentStatus;

    const method = METHODS[Math.floor(rnd() * METHODS.length)] as PaymentMethod;

    const amount =
      status === "PAID"
        ? price
        : status === "PARTIAL"
          ? Math.round((price * (0.3 + rnd() * 0.4)) / 5000) * 5000
          : 0;

    const daysAgo = Math.floor(rnd() * 180) + 1;
    const paidAt = subDays(MOCK_NOW, daysAgo);
    const courseTrainer = course ? trainers.find((t) => t.id === course.trainerId) : undefined;
    const recorderId = RECORDER_IDS[Math.floor(rnd() * RECORDER_IDS.length)] as string;
    const receiptNo = generateReceiptNo(MOCK_NOW.getFullYear(), i + 1);

    out.push({
      id: `pay_${String(i + 1).padStart(3, "0")}`,
      receiptNo,
      traineeId: trainee.id,
      courseId: trainee.courseId,
      amountRwf: amount,
      method,
      status,
      paidAt: paidAt.toISOString(),
      recordedById: recorderId,
      trainerId: courseTrainer?.id ?? "trn_001",
      reference:
        status === "UNPAID"
          ? "—"
          : `${REFERENCE_PREFIX[method]}-${String(Math.floor(rnd() * 900_000) + 100_000)}`,
      notes:
        i % 11 === 0
          ? "Second instalment — balance settled at end of cohort."
          : i % 17 === 0
            ? "Paid at the KN Nyamirambo site office."
            : "",
    });
  }

  return out.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

export const payments: Payment[] = buildPayments();

export const paymentById = new Map(payments.map((p) => [p.id, p]));

export const recorderNames = RECORDER_NAMES;

/** Per-trainee running balance across all recorded payments. */
export function balanceFor(traineeId: string): {
  totalDue: number;
  totalPaid: number;
  balance: number;
} {
  const trainee = trainees.find((t) => t.id === traineeId);
  const totalDue = trainee?.totalDueRwf ?? 0;
  const totalPaid = payments
    .filter((p) => p.traineeId === traineeId)
    .reduce((sum, p) => sum + p.amountRwf, 0);
  return { totalDue, totalPaid, balance: Math.max(0, totalDue - totalPaid) };
}
