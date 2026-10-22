import { z } from "zod";

const MANUAL_ISSUERS = new Set([
  "gahiredev01@gmail.com",
  "kigalisafetyacademy@gmail.com",
  "niyofredsoni@gmail.com",
]);

export function canIssueManualCertificate(user: { email: string; role: string; isActive?: boolean } | null | undefined) {
  return Boolean(user && user.isActive !== false &&
    (user.role === "OWNER" || user.role === "ADMIN") &&
    MANUAL_ISSUERS.has(user.email.trim().toLowerCase()));
}

export const manualCertificateSchema = z.object({
  traineeName: z.string().trim().min(2).max(160),
  courseId: z.string().min(1).max(128),
  traineeId: z.string().trim().max(128).optional(),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid issue date.").refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10);
  }, "Choose a valid date that is not in the future."),
  password: z.string().min(1, "Enter your admin password.").max(1024),
});
