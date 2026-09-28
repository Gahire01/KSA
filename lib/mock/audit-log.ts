import { subDays, subHours, subMinutes } from "date-fns";

import { generateContentHash, seededFromString } from "@/lib/utils/ids";
import type { AuditAction, AuditEntry, Role } from "@/lib/types";
import { MOCK_NOW } from "./courses";
import { certificates } from "./certificates";
import { paymentById, payments } from "./payments";
import { traineeById, trainees } from "./trainees";
import { attemptById, attempts } from "./attempts";
import { courseById } from "./courses";

const ACTORS: { id: string; name: string; role: Role }[] = [
  { id: "usr_owner", name: "Aline Mukamana", role: "OWNER" },
  { id: "usr_admin", name: "Sandrine Uwimana", role: "ADMIN" },
  { id: "usr_admin2", name: "Solange Ingabire", role: "ADMIN" },
  { id: "usr_trn_002", name: "Jean Bosco Nsengimana", role: "TRAINER" },
  { id: "usr_trn_003", name: "Claudine Uwase", role: "TRAINER" },
  { id: "usr_trn_004", name: "Eric Mugisha", role: "TRAINER" },
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

const ROLES: Role[] = ["OWNER", "ADMIN", "ADMIN", "TRAINER", "TRAINER", "TRAINER"];

function ipFor(seed: string): string {
  const rnd = seededFromString(seed);
  const bases = ["41.186.", "102.168.", "197.157.", "185.12.", "103.55."];
  return `${bases[Math.floor(rnd() * bases.length)] as string}${Math.floor(rnd() * 220)}.${Math.floor(rnd() * 250)}`;
}

interface Draft {
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

function drafts(): Draft[] {
  const out: Draft[] = [];
  const t = trainees[7]!;
  const t2 = trainees[19]!;
  const pay = payments[3]!;
  const cert = certificates[1]!;
  const revoked = certificates.find((c) => c.status === "REVOKED") ?? cert;
  const att = attempts[5]!;
  const course = courseById.get("crs_fire")!;

  out.push({
    action: "user.login",
    entityType: "session",
    entityId: "ses_9f21",
    entityLabel: "Sandrine Uwimana signed in from Kigali",
    before: null,
    after: { method: "password+mfa", device: "Chrome · Windows 11", mfa: true },
  });

  out.push({
    action: "trainee.create",
    entityType: "trainee",
    entityId: t.id,
    entityLabel: t.name,
    before: null,
    after: {
      name: t.name,
      email: t.email,
      country: t.country,
      courseId: t.courseId,
      paymentStatus: t.paymentStatus,
    },
  });

  out.push({
    action: "payment.record",
    entityType: "payment",
    entityId: pay.id,
    entityLabel: `${pay.receiptNo} — ${pay.amountRwf} RWF`,
    before: null,
    after: {
      receiptNo: pay.receiptNo,
      amountRwf: pay.amountRwf,
      method: pay.method,
      reference: pay.reference,
      status: pay.status,
    },
  });

  out.push({
    action: "trainee.update",
    entityType: "trainee",
    entityId: t2.id,
    entityLabel: t2.name,
    before: { status: "PENDING", deadline: t2.deadline },
    after: { status: "ACTIVE", deadline: t2.deadline },
  });

  out.push({
    action: "certificate.issue",
    entityType: "certificate",
    entityId: cert.id,
    entityLabel: cert.certNo,
    before: null,
    after: {
      certNo: cert.certNo,
      traineeId: cert.traineeId,
      courseId: cert.courseId,
      score: cert.score,
      contentHash: cert.contentHash.slice(0, 16),
    },
  });

  out.push({
    action: "exam.send",
    entityType: "exam",
    entityId: "exm_001",
    entityLabel: "Fire Safety Level 1 — Theory",
    before: { recipients: 0, sentAt: null },
    after: { recipients: 6, sentAt: subDays(MOCK_NOW, 9).toISOString() },
  });

  out.push({
    action: "certificate.revoke",
    entityType: "certificate",
    entityId: revoked.id,
    entityLabel: revoked.certNo,
    before: { status: "VALID" },
    after: {
      status: "REVOKED",
      reason: "Administrative error — issued against a withdrawn attempt number.",
    },
  });

  out.push({
    action: "exam.update",
    entityType: "attempt",
    entityId: att.id,
    entityLabel: `${traineeById.get(att.traineeId)?.name ?? "Candidate"} — ${att.score}%`,
    before: { status: "SUBMITTED", voided: false },
    after: { status: att.status, voided: true, reason: att.voidedReason ?? "Integrity review" },
  });

  out.push({
    action: "course.update",
    entityType: "course",
    entityId: course.id,
    entityLabel: course.name,
    before: { passMarkPct: 65, priceRwf: 110_000 },
    after: { passMarkPct: 70, priceRwf: 120_000 },
  });

  out.push({
    action: "question.update",
    entityType: "question",
    entityId: "qst_a-fire-is-sustained-by-which-combination-of-elements-1",
    entityLabel: "A fire is sustained by which combination of elements?",
    before: { difficulty: 1 },
    after: { difficulty: 2, reviewedBy: "Aline Mukamana" },
  });

  out.push({
    action: "trainer.update",
    entityType: "trainer",
    entityId: "trn_001",
    entityLabel: "Aline Mukamana",
    before: { isDefaultSigner: false, signatureUrl: "/stamp-sample.png" },
    after: { isDefaultSigner: true, signatureUrl: "/signature-sample.png" },
  });

  out.push({
    action: "payment.refund",
    entityType: "payment",
    entityId: payments[11]!.id,
    entityLabel: `${payments[11]!.receiptNo} — refund issued`,
    before: { status: "PAID", amountRwf: payments[11]!.amountRwf },
    after: { status: "REFUNDED", amountRwf: -Math.round(payments[11]!.amountRwf / 2) },
  });

  out.push({
    action: "trainee.import",
    entityType: "import",
    entityId: "imp_0041",
    entityLabel: "kigali-construction-cohort-12.csv",
    before: null,
    after: { rows: 24, imported: 21, rejected: 3, uploadedBy: "Solange Ingabire" },
  });

  out.push({
    action: "report.generate",
    entityType: "report",
    entityId: "rpt_0088",
    entityLabel: "Certificate register — PDF",
    before: null,
    after: { format: "pdf", rows: 25, generatedBy: "Sandrine Uwimana" },
  });

  out.push({
    action: "settings.update",
    entityType: "settings",
    entityId: "set_academy",
    entityLabel: "Academy settings",
    before: { defaultPassMarkPct: 70, digestMode: "instant" },
    after: { defaultPassMarkPct: 72, digestMode: "daily" },
  });

  out.push({
    action: "user.logout",
    entityType: "session",
    entityId: "ses_4b07",
    entityLabel: "Claudine Uwase signed out",
    before: null,
    after: { reason: "manual sign-out" },
  });

  out.push({
    action: "trainee.create",
    entityType: "trainee",
    entityId: trainees[42]!.id,
    entityLabel: trainees[42]!.name,
    before: null,
    after: { name: trainees[42]!.name, courseId: trainees[42]!.courseId },
  });

  out.push({
    action: "question.create",
    entityType: "question",
    entityId: "qst_new-isolator-locked-off-verified-104",
    entityLabel: "Is the isolator locked off and verified dead?",
    before: null,
    after: { courseId: "crs_elec", difficulty: 1, addedBy: "Eric Mugisha" },
  });

  out.push({
    action: "exam.create",
    entityType: "exam",
    entityId: "exm_008",
    entityLabel: "Safe Driving — Theory (draft)",
    before: null,
    after: { courseId: "crs_drive", questionCount: 8, durationMin: 40 },
  });

  /* Fill the remaining entries with realistic repeated actions. */
  const fill: AuditAction[] = [
    "payment.record",
    "trainee.update",
    "certificate.issue",
    "user.login",
    "payment.record",
    "trainee.update",
    "certificate.issue",
    "exam.send",
    "payment.record",
    "trainee.create",
    "certificate.issue",
    "user.login",
    "payment.record",
    "trainee.update",
    "exam.send",
    "course.update",
    "certificate.issue",
    "payment.record",
    "user.login",
    "trainee.create",
    "exam.update",
    "payment.record",
    "certificate.issue",
    "trainee.update",
  ];

  for (let i = 0; out.length < 40; i += 1) {
    const action = fill[i % fill.length] as AuditAction;
    const rnd = seededFromString(`fill-${i}`);
    let draft: Draft;
    switch (action) {
      case "payment.record": {
        const p = payments[(i * 5 + 4) % payments.length] as (typeof payments)[number];
        draft = {
          action,
          entityType: "payment",
          entityId: p.id,
          entityLabel: `${p.receiptNo} — ${p.amountRwf} RWF`,
          before: null,
          after: { amountRwf: p.amountRwf, method: p.method, status: p.status },
        };
        break;
      }
      case "certificate.issue": {
        const c = certificates[(i * 3 + 6) % certificates.length] as (typeof certificates)[number];
        draft = {
          action,
          entityType: "certificate",
          entityId: c.id,
          entityLabel: c.certNo,
          before: null,
          after: { certNo: c.certNo, score: c.score, hash: generateContentHash(c.certNo).slice(0, 12) },
        };
        break;
      }
      case "trainee.create":
      case "trainee.update": {
        const tr = trainees[(i * 7 + 2) % trainees.length] as (typeof trainees)[number];
        draft = {
          action,
          entityType: "trainee",
          entityId: tr.id,
          entityLabel: tr.name,
          before: action === "trainee.update" ? { paymentStatus: "UNPAID" } : null,
          after: { name: tr.name, paymentStatus: tr.paymentStatus, courseId: tr.courseId },
        };
        break;
      }
      case "exam.send": {
        const e = `exm_${String((i % 5) + 1).padStart(3, "0")}`;
        draft = {
          action,
          entityType: "exam",
          entityId: e,
          entityLabel: "Exam links dispatched",
          before: { recipients: 0 },
          after: { recipients: 4 + Math.floor(rnd() * 8), channel: "email+whatsapp" },
        };
        break;
      }
      case "exam.update": {
        const a = attemptById.get(attempts[(i * 4) % attempts.length]!.id);
        draft = {
          action,
          entityType: "attempt",
          entityId: a?.id ?? "att_001",
          entityLabel: `${traineeById.get(a?.traineeId ?? "trn_t001")?.name ?? "Candidate"}`,
          before: { integrityFlags: a?.integrityFlags.length ?? 0 },
          after: { reviewed: true, decision: "score upheld" },
        };
        break;
      }
      case "course.update": {
        const c = courseById.get(["crs_fire", "crs_first", "crs_elec"][i % 3] as string)!;
        draft = {
          action,
          entityType: "course",
          entityId: c.id,
          entityLabel: c.name,
          before: { maxAttempts: c.maxAttempts },
          after: { maxAttempts: c.maxAttempts + 1 },
        };
        break;
      }
      case "user.login": {
        const a = ACTORS[(i + 1) % ACTORS.length]!;
        draft = {
          action,
          entityType: "session",
          entityId: `ses_${(i * 977).toString(36)}`,
          entityLabel: `${a.name} signed in`,
          before: null,
          after: { mfa: true, device: "Chrome · macOS" },
        };
        break;
      }
      default: {
        const p = paymentById.get(payments[(i * 11 + 9) % payments.length]!.id);
        draft = {
          action: "payment.record",
          entityType: "payment",
          entityId: p?.id ?? "pay_001",
          entityLabel: p?.receiptNo ?? "KSA-REC-2026-00001",
          before: null,
          after: { status: "PAID" },
        };
      }
    }
    out.push(draft);
  }

  return out.slice(0, 40);
}

function build(): AuditEntry[] {
  return drafts().map((d, i) => {
    const actor = ACTORS[i % ACTORS.length]!;
    const seed = `audit-${i}`;
    const rnd = seededFromString(seed);
    const minutesAgo = i < 14 ? Math.floor(rnd() * 2_800) + 5 : Math.floor(rnd() * 40_000) + 2_900;
    const at =
      minutesAgo < 2_880
        ? subMinutes(MOCK_NOW, minutesAgo)
        : subHours(MOCK_NOW, minutesAgo / 60);
    return {
      id: `aud_${String(i + 1).padStart(3, "0")}`,
      at: at.toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: (i % 3 === 0 ? actor.role : ROLES[i % ROLES.length]) as Role,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entityId,
      entityLabel: d.entityLabel,
      ip: ipFor(seed),
      userAgent: USER_AGENTS[Math.floor(rnd() * USER_AGENTS.length)] as string,
      before: d.before,
      after: d.after,
    };
  });
}

export const auditEntries: AuditEntry[] = build().sort((a, b) => b.at.localeCompare(a.at));

export const auditById = new Map(auditEntries.map((a) => [a.id, a]));

export const AUDIT_ACTIONS: AuditAction[] = Array.from(
  new Set(auditEntries.map((a) => a.action)),
).sort();

export const AUDIT_ENTITY_TYPES = Array.from(
  new Set(auditEntries.map((a) => a.entityType)),
).sort();

export const AUDIT_ACTORS = ACTORS.map((a) => ({ id: a.id, name: a.name, role: a.role }));
