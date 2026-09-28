import { addMinutes, subDays, subHours } from "date-fns";

import { generateToken, seededFromString } from "@/lib/utils/ids";
import { shuffle } from "@/lib/utils/shuffle";
import type { AttemptAnswer, AttemptStatus, ExamAttempt, IntegrityFlag } from "@/lib/types";
import { MOCK_NOW } from "./courses";
import { examById, examByCourseId, exams } from "./exams";
import { questionsByCourse } from "./questions";
import { trainees } from "./trainees";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
];

const IP_RANGES = ["41.186.", "102.168.", "197.157.", "185.12.", "197.243.", "103.55."];

const STATUS_PLAN: { status: AttemptStatus; count: number }[] = [
  { status: "PASSED", count: 16 },
  { status: "FAILED", count: 9 },
  { status: "SUBMITTED", count: 3 },
  { status: "STARTED", count: 3 },
  { status: "SENT", count: 6 },
  { status: "VOID", count: 3 },
];

const VOID_REASONS = [
  "Candidate lost network connection twice during the session",
  "Proctor noted the candidate was assisted by another person",
  "Attempt exceeded the permitted number of retries",
];

function ipFor(seed: string): string {
  const rnd = seededFromString(seed);
  const range = IP_RANGES[Math.floor(rnd() * IP_RANGES.length)] as string;
  return `${range}${Math.floor(rnd() * 200)}.${Math.floor(rnd() * 250)}`;
}

function flagsFor(seed: string, kind: "none" | "light" | "heavy"): IntegrityFlag[] {
  if (kind === "none") return [];
  const rnd = seededFromString(seed);
  const pool: IntegrityFlag["type"][] = [
    "TAB_BLUR",
    "PASTE_ATTEMPT",
    "COPY_ATTEMPT",
    "FULLSCREEN_EXIT",
  ];
  const count = kind === "light" ? 1 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 3);
  const flags: IntegrityFlag[] = [];
  for (let i = 0; i < count; i += 1) {
    const type = pool[Math.floor(rnd() * pool.length)] as IntegrityFlag["type"];
    const detailByType: Record<IntegrityFlag["type"], string> = {
      TAB_BLUR: "Browser window lost focus",
      PASTE_ATTEMPT: "Paste blocked in answer field",
      COPY_ATTEMPT: "Copy blocked during question",
      FULLSCREEN_EXIT: "Exited fullscreen presentation mode",
      LATE_SUBMIT: "Submitted after the exam window closed",
    };
    flags.push({
      id: `flg_${seed}_${i}`,
      type,
      at: addMinutes(subHours(MOCK_NOW, Math.floor(rnd() * 200)), Math.floor(rnd() * 55)).toISOString(),
      detail: detailByType[type],
    });
  }
  return flags.sort((a, b) => a.at.localeCompare(b.at));
}

function buildAttempts(): ExamAttempt[] {
  const rnd = seededFromString("ksa-attempts-v1");
  const plan: AttemptStatus[] = [];
  for (const s of STATUS_PLAN) {
    for (let i = 0; i < s.count; i += 1) plan.push(s.status);
  }

  const activeExams = exams.filter(
    (e) => e.status === "ACTIVE" || e.status === "COMPLETED",
  );
  const out: ExamAttempt[] = [];

  for (let i = 0; i < plan.length; i += 1) {
    const status = plan[i] as AttemptStatus;
    const exam = activeExams[Math.floor(rnd() * activeExams.length)] as (typeof activeExams)[number];
    const pool = trainees.filter((t) => t.courseId === exam.courseId);
    const trainee =
      pool.length > 0
        ? pool[Math.floor(rnd() * pool.length)]
        : (trainees[Math.floor(rnd() * trainees.length)] as (typeof trainees)[number]);

    const bank = questionsByCourse.get(exam.courseId) ?? [];
    const token = generateToken("exm", `attempt-${i}-${trainee.id}`);
    const served = shuffle(bank, token).slice(0, exam.questionsToServe || bank.length);

    const startedBase = subDays(MOCK_NOW, Math.floor(rnd() * 40) + 1);
    const startedAt =
      status === "SENT" ? null : addMinutes(startedBase, Math.floor(rnd() * 60));
    const durationUsedSec =
      status === "SENT" || status === "STARTED"
        ? status === "STARTED"
          ? Math.floor(rnd() * 300) + 60
          : null
        : Math.floor(rnd() * (exam.durationMin * 60 * 0.85)) + 120;
    const submittedAt =
      startedAt && (status === "SUBMITTED" || status === "PASSED" || status === "FAILED" || status === "VOID")
        ? addMinutes(startedAt, Math.max(1, Math.round((durationUsedSec ?? 300) / 60)))
        : null;

    /* Answers: simulate a target score and mark per question. */
    const targetPct =
      status === "PASSED"
        ? exam.passMarkPct + 3 + rnd() * (100 - exam.passMarkPct - 3)
        : status === "FAILED"
          ? Math.max(15, exam.passMarkPct - 18 - rnd() * 25)
          : status === "SUBMITTED"
            ? exam.passMarkPct + rnd() * 10
            : 0;

    const perQuestion: AttemptAnswer[] = [];
    if (status !== "SENT") {
      const wantedCorrect = Math.round((targetPct / 100) * served.length);
      const correctSet = new Set<number>();
      while (correctSet.size < wantedCorrect && correctSet.size < served.length) {
        correctSet.add(Math.floor(rnd() * served.length));
      }
      served.forEach((q, qi) => {
        const correctOpt = q.options.find((o) => o.isCorrect);
        const wrongOpts = q.options.filter((o) => !o.isCorrect);
        const isCorrect = correctSet.has(qi);
        const selected = isCorrect
          ? correctOpt
          : wrongOpts[Math.floor(rnd() * wrongOpts.length)];
        perQuestion.push({
          questionId: q.id,
          selectedOptionId: selected?.id ?? null,
          correctOptionId: correctOpt?.id ?? "",
          isCorrect,
          timeSpentSec: Math.floor(rnd() * 90) + 8,
        });
      });
    }

    const correctCount = perQuestion.filter((a) => a.isCorrect).length;
    const score =
      served.length > 0 && correctCount > 0
        ? Math.round((correctCount / served.length) * 100)
        : 0;

    const flagKind = i % 7 === 3 ? "heavy" : i % 5 === 2 ? "light" : "none";
    const integrityFlags = flagsFor(`att-${i}`, flagKind);

    const attemptNumber =
      status === "SENT" ? 1 : 1 + Math.floor(rnd() * (status === "VOID" ? 1 : 2));

    out.push({
      id: `att_${String(i + 1).padStart(3, "0")}`,
      examId: exam.id,
      traineeId: trainee.id,
      courseId: exam.courseId,
      token,
      status,
      attemptNumber,
      score: status === "SENT" || status === "STARTED" ? null : score,
      correctCount: status === "SENT" ? null : correctCount,
      questionCount: served.length,
      startedAt: startedAt ? startedAt.toISOString() : null,
      submittedAt: submittedAt ? submittedAt.toISOString() : null,
      durationUsedSec: status === "SENT" ? null : durationUsedSec,
      ip: ipFor(`att-${i}`),
      userAgent: USER_AGENTS[Math.floor(rnd() * USER_AGENTS.length)] as string,
      integrityFlags,
      answers: Object.fromEntries(perQuestion.map((a) => [a.questionId, a.selectedOptionId ?? ""])),
      perQuestion,
      voidedReason: status === "VOID" ? VOID_REASONS[i % VOID_REASONS.length] : undefined,
    });
  }

  return out.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

export const attempts: ExamAttempt[] = buildAttempts();

export const attemptById = new Map(attempts.map((a) => [a.id, a]));
export const attemptByToken = new Map(attempts.map((a) => [a.token, a]));

/** Populate recipient counts now that attempts exist. */
for (const exam of exams) {
  exam.recipientsCount = attempts.filter((a) => a.examId === exam.id).length;
}

export function examForToken(token: string) {
  const attempt = attemptByToken.get(token);
  if (!attempt) return null;
  const exam = examById.get(attempt.examId);
  return exam ? { attempt, exam } : null;
}

export function defaultRunnerToken(): string | null {
  const exam = examByCourseId.get("crs_fire");
  if (!exam) return attempts[0]?.token ?? null;
  const open = attempts.find((a) => a.examId === exam.id);
  return open?.token ?? null;
}

export function questionsForAttempt(attempt: ExamAttempt) {
  const bank = questionsByCourse.get(attempt.courseId) ?? [];
  const ids = attempt.perQuestion.map((p) => p.questionId);
  const ordered = shuffle(bank, attempt.token);
  return ordered
    .filter((q) => ids.length === 0 || ids.includes(q.id))
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}
