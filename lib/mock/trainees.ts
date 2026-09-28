import { addDays, subDays, subHours } from "date-fns";

import { seededFromString } from "@/lib/utils/ids";
import type {
  Category,
  Country,
  EnrollmentStatus,
  PaymentStatus,
  Trainee,
} from "@/lib/types";
import { MOCK_NOW, courses, courseById } from "./courses";

const GIVEN = [
  "Eric", "Clarisse", "Patrick", "Diane", "Jean Bosco", "Alice", "Emmanuel",
  "Grace", "Olivier", "Sandrine", "Thabo", "Peace", "Fabrice", "Josiane",
  "Innocent", "Providence", "Serge", "Yvette", "Désiré", "Bromise",
  "Clementine", "Aline", "Ericson", "Divine", "Bertrand", "Solange",
  "Aubin", "Chantal", "Donatien", "Esther", "Fiston", "Gisele", "Hakim",
  "Isabelle", "Joel", "Kareke", "Landry", "Merveille", "Nathalie", "Olivier",
  "Pacifique", "Rehema", "Samuel", "Theodose", "Vestine", "Yannick",
  "Aline", "Bosco", "Christian", "Denise", "Emmanuel", "Francoise", "Gilbert",
  "Herve", "Immaculee", "Jean Claude", "Laurence", "Moses", "Nadine",
  "Olivier", "Pierre", "Regina", "Sylvie", "Timothee", "Umurunga",
];

const FAMILY = [
  "Mugisha", "Uwase", "Habimana", "Niyonsaba", "Nsengimana", "Mukamana",
  "Iradukunda", "Umutoni", "Bizimana", "Hakizimana", "Nshimiyimana",
  "Twagirayezu", "Ingabire", "Mukeshi", "Ndayisaba", "Uwimana", "Rwigema",
  "Mutesi", "Kagirimpundu", "Nkurunzinya", "Sekamana", "Gitana",
  "Kayitare", "Munyaneza", "Ibyimanana", "Ndagijimana", "Uwamariya",
  "Harerimana", "Nsabimana", "Mutoni", "Gahore", "Dusingizimana",
  "Uwamahoro", "Kanziga", "Byiringiro", "Tuyisenge", "Habineza", "Uwera",
  "Mugabo", "Kwizera", "Irembera", "Nyirahabimana", "Hakobayire", "Ndarampe",
  "Uwacyanu", "Kaze", "Ruhara", "Nshuti", "Umulisa", "Byamugisha",
  "Keza", "Munyaneza", "Ndahiro", "Bikoni",
];

const COUNTRIES: Country[] = ["Rwanda", "Uganda", "Kenya", "Tanzania", "Burundi", "DRC"];

const DIAL: Record<Country, string> = {
  Rwanda: "+250",
  Uganda: "+256",
  Kenya: "+254",
  Tanzania: "+255",
  Burundi: "+257",
  DRC: "+243",
};

const NOTES = [
  "Night-shift worker — exams must be scheduled before 14:00.",
  "Referred by Nyamirambo Construction Ltd.",
  "Requires interpreter for the theory paper (Swahili).",
  "Previously failed the practical; rebooked for this cohort.",
  "Site induction completed 12 days before enrolment.",
  "Requested certificate in both English and French.",
  "Mobility considerations noted by the training team.",
  "Employed by the Musanze Industrial Park contractor.",
  "",
  "",
  "",
];

/** Weighted course preference so FIRE/FIRST look busier than DRIVE. */
const COURSE_WEIGHTS: string[] = [
  "crs_fire", "crs_fire", "crs_fire", "crs_fire",
  "crs_first", "crs_first", "crs_first",
  "crs_maint", "crs_maint", "crs_maint",
  "crs_site", "crs_site", "crs_site",
  "crs_elec", "crs_elec",
  "crs_height", "crs_height",
  "crs_chem", "crs_drive",
];

const STATUSES: EnrollmentStatus[] = [
  "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE",
  "COMPLETED", "COMPLETED", "COMPLETED",
  "PENDING", "PENDING", "PENDING",
  "SUSPENDED",
];

const PAYMENTS: PaymentStatus[] = [
  "PAID", "PAID", "PAID", "PAID", "PAID", "PAID", "PAID", "PAID",
  "PARTIAL", "PARTIAL", "PARTIAL",
  "UNPAID", "UNPAID",
];

function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)] as T;
}

export const TRAINEES_COUNT = 60;

function buildTrainees(): Trainee[] {
  const rnd = seededFromString("ksa-trainees-v1");
  const out: Trainee[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < TRAINEES_COUNT; i += 1) {
    let name = "";
    let guard = 0;
    do {
      name = `${GIVEN[(i + guard) % GIVEN.length]} ${FAMILY[(i * 7 + guard * 3) % FAMILY.length]}`;
      guard += 1;
    } while (usedNames.has(name) && guard < 200);
    usedNames.add(name);

    const courseId = COURSE_WEIGHTS[Math.floor(rnd() * COURSE_WEIGHTS.length)] as string;
    const course = courseById.get(courseId) ?? courses[0]!;
    const country = rnd() < 0.72 ? "Rwanda" : pick(rnd, COUNTRIES);
    const status = STATUSES[Math.floor(rnd() * STATUSES.length)] as EnrollmentStatus;
    const paymentStatus = PAYMENTS[Math.floor(rnd() * PAYMENTS.length)] as PaymentStatus;

    const daysAgoEnrolled = Math.floor(rnd() * 210) + 2;
    const enrolledAt = subDays(MOCK_NOW, daysAgoEnrolled);
    const deadlineSpan =
      course.durationUnit === "day"
        ? course.durationValue
        : course.durationUnit === "week"
          ? course.durationValue * 7
          : course.durationValue * 30;
    const deadline = addDays(enrolledAt, deadlineSpan);

    const price = course.priceRwf;
    const amountPaid =
      paymentStatus === "PAID"
        ? price
        : paymentStatus === "PARTIAL"
          ? Math.round((price * (0.25 + rnd() * 0.5)) / 5000) * 5000
          : 0;

    const attendancePct =
      status === "PENDING"
        ? 0
        : Math.min(100, Math.round(48 + rnd() * 52));

    const examScore =
      status === "COMPLETED"
        ? Math.min(100, Math.round(course.passMarkPct + 4 + rnd() * (100 - course.passMarkPct - 4)))
        : null;

    const sequence = i + 1;
    const createdAt = subDays(enrolledAt, Math.floor(rnd() * 20) + 1);
    const updatedAt = subHours(MOCK_NOW, Math.floor(rnd() * 96));
    const local = name.toLowerCase().replace(/[^a-z]+/g, ".");

    out.push({
      id: `trn_t${String(sequence).padStart(3, "0")}`,
      traineeNo: `${course.code}-${MOCK_NOW.getFullYear()}-${String(sequence).padStart(4, "0")}`,
      name,
      email: `${local}@${country === "Rwanda" ? "gmail.com" : "mail.co"}`.replace(/\.$/, ""),
      phone: `${DIAL[country]} 7${String(Math.floor(rnd() * 900) + 100)} ${String(Math.floor(rnd() * 900) + 100)} ${String(Math.floor(rnd() * 900) + 100)}`,
      country,
      category: course.category as Category,
      status,
      paymentStatus,
      amountPaidRwf: amountPaid,
      totalDueRwf: price,
      courseId,
      enrolledAt: enrolledAt.toISOString(),
      deadline: deadline.toISOString(),
      attendancePct,
      examScore,
      notes: NOTES[Math.floor(rnd() * NOTES.length)] ?? "",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  }

  return out;
}

export const trainees: Trainee[] = buildTrainees();

export const traineeById = new Map(trainees.map((t) => [t.id, t]));

/** Enrollments are 1:1 with the mock trainee record's primary course. */
export const enrollments = trainees.map((t) => ({
  id: `enr_${t.id}`,
  traineeId: t.id,
  courseId: t.courseId,
  status: t.status,
  enrolledAt: t.enrolledAt,
  deadline: t.deadline,
  attendancePct: t.attendancePct,
  examScore: t.examScore,
  passedAt: t.status === "COMPLETED" ? t.updatedAt : null,
  paymentStatus: t.paymentStatus,
}));
