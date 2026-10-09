import type { DurationUnit } from "../../lib/generated/prisma/client";
import { EXAM_DURATION_MIN, MAX_ATTEMPTS, PASS_MARK_PCT } from "../../lib/exams/rules";

/**
 * The academy's five courses. Nothing else is offered: any other course row already
 * in a database is switched off by the seed (never deleted, since it may hold
 * enrolments). Every course carries the same exam rules from lib/exams/rules.ts.
 */

export const COURSE_CODES = ["CONSTRUCT", "OSH", "FIRST", "FIRE", "RIGGER"] as const;

export type SeedCourse = {
  code: (typeof COURSE_CODES)[number];
  name: string;
  category: string;
  description: string;
  topics: string[];
  durationValue: number;
  durationUnit: DurationUnit;
  /** The standard price: the middle tier of three, or the only one. */
  priceRwf: number;
  priceTiers: Array<{ label: string; amountRwf: number }>;
  validityMonths: number | null;
  passMarkPct: number;
  maxAttempts: number;
  examDurationMin: number;
};

const RULES = {
  passMarkPct: PASS_MARK_PCT,
  maxAttempts: MAX_ATTEMPTS,
  examDurationMin: EXAM_DURATION_MIN,
} as const;

export const COURSES: SeedCourse[] = [
  {
    code: "CONSTRUCT",
    name: "Construction Safety And Health Management",
    category: "Construction Safety",
    description:
      "The Construction Safety and Health Management course equips learners with essential skills to identify hazards, assess risks, and implement effective safety controls on construction sites. It focuses on accident prevention, safe work practices, use of PPE, and emergency preparedness, with the aim of strengthening workplace safety and promoting a strong safety culture in construction projects. In addition to classroom sessions, the course includes onsite learning through construction site visits, providing participants with practical exposure and real-life understanding of safety management in active project environments.",
    topics: [
      "Management Leadership",
      "Worker Participation",
      "Hazard Identification",
      "Risk Assessment",
      "Prevention and Control",
      "PPE and Safe Work Practices",
      "Emergency Preparedness",
      "Manhours & Incident Rates",
      "Site Induction",
      "Work at Height",
      "Housekeeping",
      "LTI and Incident Management",
      "General Construction Safety",
      "Onsite Practical Assessment",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 250_000,
    priceTiers: [
      { label: "Basic", amountRwf: 100_000 },
      { label: "Standard", amountRwf: 250_000 },
      { label: "Comprehensive", amountRwf: 300_000 },
    ],
    validityMonths: null,
    ...RULES,
  },
  {
    code: "OSH",
    name: "Occupational Safety and Health",
    category: "Occupational Safety",
    description:
      "Occupational Safety and Health (OSH) is the discipline concerned with protecting the safety, health, and welfare of workers in all workplaces by identifying hazards, assessing risks, and implementing effective preventive and control measures to reduce accidents, injuries, and occupational diseases. It promotes safe working practices, proper use of personal protective equipment, compliance with legal requirements, and continuous improvement of workplace safety systems to ensure a safe and healthy working environment for all employees.",
    topics: [
      "Hazard Identification",
      "Risk Assessment",
      "Preventive and Control Measures",
      "Personal Protective Equipment",
      "Legal Compliance",
      "Workplace Safety Systems",
      "Continuous Improvement",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 200_000,
    priceTiers: [
      { label: "Basic", amountRwf: 100_000 },
      { label: "Standard", amountRwf: 200_000 },
      { label: "Comprehensive", amountRwf: 250_000 },
    ],
    validityMonths: null,
    ...RULES,
  },
  {
    code: "FIRST",
    name: "First Aid",
    category: "First Aid",
    description:
      "First Aid training provides essential knowledge and practical skills to respond to medical emergencies in workplaces and everyday situations. It focuses on giving immediate care to an injured or suddenly ill person before professional medical help arrives, with the aim of preserving life, preventing the condition from worsening, and supporting recovery through basic emergency procedures such as wound care, bleeding control, and basic life support.",
    topics: [
      "First Aid Principles",
      "CPR & AED",
      "Bleeding Control & Wound Care",
      "Fractures & Injuries",
      "Burns Management",
      "Basic Life Support",
      "Emergency Response & Practical Assessments",
    ],
    durationValue: 1,
    durationUnit: "DAY",
    priceRwf: 40_000,
    priceTiers: [
      { label: "Basic", amountRwf: 30_000 },
      { label: "Standard", amountRwf: 40_000 },
      { label: "Comprehensive", amountRwf: 50_000 },
    ],
    validityMonths: null,
    ...RULES,
  },
  {
    code: "FIRE",
    name: "Fire Fighting Training",
    category: "Firefighters",
    description:
      "Fire Fighting training provides essential knowledge and practical skills to prevent, control, and respond to fire emergencies in the workplace and other environments. It focuses on understanding fire hazards, safe use of fire extinguishers, evacuation procedures, and emergency response techniques to protect lives, property, and the environment by ensuring timely and effective action during fire incidents.",
    topics: [
      "Fire Classes & Behavior",
      "Fire Hazards",
      "Extinguisher Types & Safe Use",
      "Evacuation Procedures",
      "Emergency Response Techniques",
      "Fire Prevention",
      "First Aid Response During Fire Emergencies",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 30_000,
    priceTiers: [{ label: "Standard", amountRwf: 30_000 }],
    validityMonths: null,
    ...RULES,
  },
  {
    code: "RIGGER",
    name: "Rigger Safety Training",
    category: "Rigging & Lifting",
    description:
      "Rigger Safety Training equips workers with the essential knowledge and practical skills required to plan and perform lifting operations safely. The course covers load assessment, selection and inspection of lifting equipment, sling angles and capacity, safe rigging techniques, use of tag lines, communication with crane operators, exclusion zones, and hazard control during lifting operations. It emphasizes planning, inspection, competent personnel, and keeping people clear of suspended loads to prevent serious injury or death.",
    topics: [
      "Lifting Plan and Load Assessment",
      "Sling Types and Inspection",
      "Sling Angles and Rated Capacity",
      "Rigging Techniques and Load Control",
      "Tag Lines and Communication",
      "Exclusion Zones and Line of Fire",
      "Crane Hand Signals",
      "Critical Lift Planning",
    ],
    durationValue: 3,
    durationUnit: "MONTH",
    priceRwf: 40_000,
    priceTiers: [
      { label: "Basic", amountRwf: 30_000 },
      { label: "Standard", amountRwf: 40_000 },
      { label: "Comprehensive", amountRwf: 50_000 },
    ],
    validityMonths: null,
    ...RULES,
  },
];
