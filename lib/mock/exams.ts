import { addDays, subDays } from "date-fns";

import type { Exam } from "@/lib/types";
import { MOCK_NOW, courseById, courses } from "./courses";
import { questionsByCourse } from "./questions";

type ExamSeed = {
  courseId: string;
  title: string;
  status: Exam["status"];
  sentOffsetDays: number | null;
  closesInDays: number | null;
  questionCount: number;
  questionsToServe: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

const seeds: ExamSeed[] = [
  {
    courseId: "crs_fire",
    title: "Fire Safety Level 1 — Theory",
    status: "ACTIVE",
    sentOffsetDays: 9,
    closesInDays: 21,
    questionCount: 20,
    questionsToServe: 20,
    shuffleQuestions: true,
    shuffleOptions: true,
  },
  {
    courseId: "crs_first",
    title: "First Aid & CPR — Theory",
    status: "ACTIVE",
    sentOffsetDays: 4,
    closesInDays: 12,
    questionCount: 8,
    questionsToServe: 20,
    shuffleQuestions: true,
    shuffleOptions: true,
  },
  {
    courseId: "crs_elec",
    title: "Electrical Safety (LV) — Theory",
    status: "ACTIVE",
    sentOffsetDays: 14,
    closesInDays: 6,
    questionCount: 8,
    questionsToServe: 16,
    shuffleQuestions: true,
    shuffleOptions: false,
  },
  {
    courseId: "crs_maint",
    title: "Mechanical Maintenance Safety — Theory",
    status: "ACTIVE",
    sentOffsetDays: 3,
    closesInDays: 27,
    questionCount: 8,
    questionsToServe: 18,
    shuffleQuestions: false,
    shuffleOptions: true,
  },
  {
    courseId: "crs_height",
    title: "Working at Height — Theory",
    status: "ACTIVE",
    sentOffsetDays: 6,
    closesInDays: 18,
    questionCount: 8,
    questionsToServe: 16,
    shuffleQuestions: true,
    shuffleOptions: true,
  },
  {
    courseId: "crs_site",
    title: "Site Security — Theory",
    status: "SCHEDULED",
    sentOffsetDays: null,
    closesInDays: null,
    questionCount: 8,
    questionsToServe: 8,
    shuffleQuestions: false,
    shuffleOptions: false,
  },
  {
    courseId: "crs_chem",
    title: "Hazardous Chemicals — Theory",
    status: "COMPLETED",
    sentOffsetDays: 96,
    closesInDays: null,
    questionCount: 8,
    questionsToServe: 8,
    shuffleQuestions: false,
    shuffleOptions: false,
  },
  {
    courseId: "crs_drive",
    title: "Safe Driving — Theory",
    status: "DRAFT",
    sentOffsetDays: null,
    closesInDays: null,
    questionCount: 8,
    questionsToServe: 8,
    shuffleQuestions: true,
    shuffleOptions: false,
  },
];

export const exams: Exam[] = seeds.map((s, i) => {
  const course = courseById.get(s.courseId) ?? courses[0]!;
  const sent = s.sentOffsetDays === null ? null : subDays(MOCK_NOW, s.sentOffsetDays);
  return {
    id: `exm_${String(i + 1).padStart(3, "0")}`,
    courseId: s.courseId,
    title: s.title,
    status: s.status,
    passMarkPct: course.passMarkPct,
    maxAttempts: course.maxAttempts,
    durationMin: course.examDurationMin,
    questionCount: s.questionCount,
    questionsToServe: Math.min(s.questionsToServe, s.questionCount),
    shuffleQuestions: s.shuffleQuestions,
    shuffleOptions: s.shuffleOptions,
    recipientsCount: 0,
    sentAt: sent ? sent.toISOString() : null,
    opensAt: s.sentOffsetDays === null ? null : sent!.toISOString(),
    closesAt: s.closesInDays === null ? null : addDays(MOCK_NOW, s.closesInDays).toISOString(),
    createdAt: subDays(sent ?? MOCK_NOW, 12).toISOString(),
    trainerId: course.trainerId,
  };
});

export const examById = new Map(exams.map((e) => [e.id, e]));

export const examByCourseId = new Map(exams.map((e) => [e.courseId, e]));

/** Bank size shown on the exam row (differs from questions served). */
export function bankSizeFor(courseId: string): number {
  return questionsByCourse.get(courseId)?.length ?? 0;
}
