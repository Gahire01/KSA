import type { Course, ReportDefinition } from "@/lib/types";

/**
 * Fixed reference date for all generated mock data so the demo is
 * deterministic. Every relative date in the app is derived from it.
 */
export const MOCK_NOW = new Date("2026-09-28T08:30:00.000Z");

export const BASE_YEAR = 2026;

export const courses: Course[] = [
  {
    id: "crs_fire",
    code: "FIRE",
    name: "Fire Safety Level 1",
    category: "Firefighters",
    description:
      "Foundational fire behaviour, classes of fire, extinguisher selection, evacuation procedure and hot-work permitting for site personnel.",
    durationValue: 3,
    durationUnit: "day",
    priceRwf: 120_000,
    passMarkPct: 70,
    maxAttempts: 3,
    validityMonths: null,
    examDurationMin: 45,
    trainerId: "trn_001",
    questionCount: 20,
    isActive: true,
    enrolledCount: 148,
    createdAt: "2025-02-11T09:00:00.000Z",
  },
  {
    id: "crs_maint",
    code: "MAINT",
    name: "Mechanical Maintenance Safety",
    category: "Maintenance",
    description:
      "Machine guarding, lockout/tagout, hot work, pneumatic and hydraulic hazards, and safe isolation of industrial plant.",
    durationValue: 5,
    durationUnit: "day",
    priceRwf: 185_000,
    passMarkPct: 70,
    maxAttempts: 3,
    validityMonths: null,
    examDurationMin: 60,
    trainerId: "trn_002",
    questionCount: 8,
    isActive: true,
    enrolledCount: 96,
    createdAt: "2025-02-11T09:05:00.000Z",
  },
  {
    id: "crs_first",
    code: "FIRST",
    name: "First Aid & CPR",
    category: "First Aid",
    description:
      "Scene safety, primary survey, recovery position, CPR on adults and children, and treatment of bleeding, burns and shock.",
    durationValue: 2,
    durationUnit: "day",
    priceRwf: 85_000,
    passMarkPct: 75,
    maxAttempts: 4,
    validityMonths: null,
    examDurationMin: 30,
    trainerId: "trn_003",
    questionCount: 8,
    isActive: true,
    enrolledCount: 174,
    createdAt: "2025-02-12T08:30:00.000Z",
  },
  {
    id: "crs_site",
    code: "SITE",
    name: "Site Security & Access Control",
    category: "Site Security",
    description:
      "Access control procedure, visitor management, patrol discipline, incident reporting and radio discipline for site guards.",
    durationValue: 4,
    durationUnit: "week",
    priceRwf: 65_000,
    passMarkPct: 65,
    maxAttempts: 3,
    validityMonths: null,
    examDurationMin: 40,
    trainerId: "trn_001",
    questionCount: 8,
    isActive: true,
    enrolledCount: 121,
    createdAt: "2025-03-02T10:15:00.000Z",
  },
  {
    id: "crs_elec",
    code: "ELEC",
    name: "Electrical Safety (Low Voltage)",
    category: "Electrical Safety",
    description:
      "Electrical hazards, safe isolation and proving dead, arc-flash awareness, cable management and residual-current protection.",
    durationValue: 5,
    durationUnit: "day",
    priceRwf: 210_000,
    passMarkPct: 80,
    maxAttempts: 2,
    validityMonths: null,
    examDurationMin: 60,
    trainerId: "trn_004",
    questionCount: 8,
    isActive: true,
    enrolledCount: 87,
    createdAt: "2025-03-04T11:00:00.000Z",
  },
  {
    id: "crs_height",
    code: "HEIGHT",
    name: "Working at Height",
    category: "Working at Height",
    description:
      "Fall prevention and protection, ladder and scaffold inspection, harness selection, anchor points and rescue planning.",
    durationValue: 2,
    durationUnit: "day",
    priceRwf: 95_000,
    passMarkPct: 75,
    maxAttempts: 3,
    validityMonths: null,
    examDurationMin: 45,
    trainerId: "trn_002",
    questionCount: 8,
    isActive: true,
    enrolledCount: 103,
    createdAt: "2025-03-10T13:45:00.000Z",
  },
  {
    id: "crs_chem",
    code: "CHEM",
    name: "Hazardous Chemicals & COSHH",
    category: "Maintenance",
    description:
      "Safety data sheets, exposure pathways, ventilation and respiratory protection, storage segregation and spill response.",
    durationValue: 1,
    durationUnit: "week",
    priceRwf: 78_000,
    passMarkPct: 70,
    maxAttempts: 3,
    validityMonths: null,
    examDurationMin: 40,

    trainerId: "trn_003",
    questionCount: 8,
    isActive: false,
    enrolledCount: 54,
    createdAt: "2025-04-18T08:00:00.000Z",
  },
  {
    id: "crs_drive",
    code: "DRIVE",
    name: "Safe Driving & Fleet Safety",
    category: "Site Security",
    description:
      "Defensive driving, load security, pre-trip inspection, fatigue management and incident response for fleet drivers.",
    durationValue: 3,
    durationUnit: "day",
    priceRwf: 110_000,
    passMarkPct: 70,
    maxAttempts: 3,
    validityMonths: null,
    examDurationMin: 40,
    trainerId: "trn_004",
    questionCount: 8,
    isActive: true,
    enrolledCount: 76,
    createdAt: "2025-05-06T09:20:00.000Z",
  },
];

export const courseById = new Map(courses.map((c) => [c.id, c]));

export const reportDefinitions: ReportDefinition[] = [
  {
    type: "trainee-roster",
    title: "Trainee roster",
    description:
      "Every registered trainee with ID, contact, country, course and enrolment status.",
    rowEstimate: 60,
  },
  {
    type: "attendance-sheet",
    title: "Attendance sheet",
    description:
      "Per-course attendance register with percentage present for each enrolled trainee.",
    rowEstimate: 60,
  },
  {
    type: "exam-results",
    title: "Exam results",
    description:
      "Every attempt with score, pass mark applied, duration used and integrity flags.",
    rowEstimate: 40,
  },
  {
    type: "certificate-register",
    title: "Certificate register",
    description:
      "Issued certificates with number, verification token, issue and expiry dates.",
    rowEstimate: 25,
  },
  {
    type: "payment-ledger",
    title: "Payment ledger",
    description:
      "All recorded payments with method, reference, recorder and running balance.",
    rowEstimate: 80,
  },
  {
    type: "trainer-activity",
    title: "Trainer activity",
    description:
      "Certificates issued, exams sent and cohort load per trainer.",
    rowEstimate: 4,
  },
  {
    type: "revenue-summary",
    title: "Revenue summary",
    description:
      "Collected versus invoiced revenue by month and by course.",
    rowEstimate: 8,
  },
];
