import { subMinutes } from "date-fns";

import { seededFromString } from "@/lib/utils/ids";
import type { AppNotification, NotificationType } from "@/lib/types";
import { MOCK_NOW } from "./courses";

interface NotificationSeed {
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  actor: string;
  mention?: boolean;
  unread: boolean;
}

const seeds: NotificationSeed[] = [
  { type: "exam.submitted", title: "Exam submitted", body: "Eric Mugisha submitted Fire Safety Level 1 with 82%.", link: "/exams/exm_001/attempts/att_001", actor: "Eric Mugisha", unread: true },
  { type: "payment.recorded", title: "Payment recorded", body: "45,000 RWF recorded for Clarisse Uwase via MoMo.", link: "/payments", actor: "Sandrine Uwimana", unread: true },
  { type: "trainee.enrolled", title: "New trainee", body: "Patrick Habimana was enrolled in Working at Height.", link: "/trainees", actor: "Aline Mukamana", unread: true, mention: true },
  { type: "deadline.approaching", title: "Deadlines approaching", body: "3 trainees have exams due within the next 48 hours.", link: "/trainees?status=ACTIVE", actor: "System", unread: true },
  { type: "certificate.expiring", title: "Certificates expiring", body: "2 Fire Safety Level 1 certificates expire within 30 days.", link: "/certificates?status=EXPIRING", actor: "System", unread: true },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00007 issued to Diane Niyonsaba.", link: "/certificates", actor: "Claudine Uwase", unread: true },
  { type: "exam.link.expiring", title: "Exam links expiring", body: "Electrical Safety (LV) exam links expire today at 23:59.", link: "/exams/exm_003", actor: "System", unread: true },
  { type: "exam.submitted", title: "Exam submitted", body: "Landry Sekamana submitted First Aid & CPR with 76%.", link: "/exams/exm_002", actor: "Landry Sekamana", unread: true },
  { type: "payment.recorded", title: "Payment recorded", body: "210,000 RWF recorded for Donatien Ingabire via bank transfer.", link: "/payments", actor: "Sandrine Uwimana", unread: true, mention: true },
  { type: "trainee.enrolled", title: "New trainee", body: "Bosco Twagirayezu was enrolled in Electrical Safety (Low Voltage).", link: "/trainees", actor: "Eric Mugisha", unread: true },
  { type: "deadline.approaching", title: "Deadlines approaching", body: "Fire Safety Level 1 cohort 14 reports in 5 days.", link: "/exams/exm_001", actor: "System", unread: true },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00019 issued to Innocent Harerimana.", link: "/certificates", actor: "Jean Bosco Nsengimana", unread: true },

  { type: "exam.submitted", title: "Exam submitted", body: "Soline Byiringiro submitted Site Security & Access Control.", link: "/exams", actor: "Soline Byiringiro", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "95,000 RWF recorded for Théoneste Nshuti in cash.", link: "/payments", actor: "Front desk — Solange I.", unread: false },
  { type: "certificate.expiring", title: "Certificates expiring", body: "1 First Aid & CPR certificate expires in 12 days — no renewal booked.", link: "/certificates?status=EXPIRING", actor: "System", unread: false },
  { type: "trainee.enrolled", title: "New trainee", body: "Aline Nyirahabimana enrolled in Safe Driving & Fleet Safety.", link: "/trainees", actor: "Eric Mugisha", unread: false },
  { type: "exam.link.expiring", title: "Exam links expiring", body: "First Aid & CPR links expire in 3 days.", link: "/exams/exm_002", actor: "System", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Fiston Mukeshi submitted Mechanical Maintenance Safety with 58%.", link: "/exams/exm_004", actor: "Fiston Mukeshi", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "78,000 RWF recorded for Providence Gahore via MoMo.", link: "/payments", actor: "Sandrine Uwimana", unread: false },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00022 issued to Chantal Uwacyanu.", link: "/certificates", actor: "Claudine Uwase", unread: false },
  { type: "deadline.approaching", title: "Deadlines approaching", body: "9 Working at Height trainees are inside the final week.", link: "/trainees", actor: "System", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Serge Keza submitted Electrical Safety (Low Voltage) with 91%.", link: "/exams/exm_003", actor: "Serge Keza", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "110,000 RWF recorded for Yves Ndahiro via card.", link: "/payments", actor: "Aline Mukamana", unread: false },
  { type: "trainee.enrolled", title: "New trainee", body: "Divine Munyaneza enrolled in First Aid & CPR.", link: "/trainees", actor: "Claudine Uwase", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Gisele Umulisa submitted Fire Safety Level 1 — awaiting review.", link: "/exams/exm_001", actor: "Gisele Umulisa", unread: false },
  { type: "certificate.expiring", title: "Certificates expiring", body: "3 Site Security certificates expire in 21 days.", link: "/certificates?status=EXPIRING", actor: "System", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "185,000 RWF recorded for Olivier Mutesi via bank transfer.", link: "/payments", actor: "Sandrine Uwimana", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Pacifique Hakizimana submitted Working at Height with 80%.", link: "/exams/exm_005", actor: "Pacifique Hakizimana", unread: false },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00011 issued to Ericson Irembera.", link: "/certificates", actor: "Aline Mukamana", unread: false },
  { type: "deadline.approaching", title: "Deadlines approaching", body: "Maintenance cohort 22 is 80% complete.", link: "/courses/crs_maint", actor: "System", unread: false },
  { type: "trainee.enrolled", title: "New trainee", body: "Bikoni Ruhara enrolled in Mechanical Maintenance Safety.", link: "/trainees", actor: "Jean Bosco Nsengimana", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "65,000 RWF recorded for Yvette Ibyimanana in cash.", link: "/payments", actor: "Front desk — Solange I.", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Moses Birindwa submitted Fire Safety Level 1 with 66%.", link: "/exams/exm_001", actor: "Moses Birindwa", unread: false },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00024 issued to Esther Ndayisaba.", link: "/certificates", actor: "Claudine Uwase", unread: false },
  { type: "exam.link.expiring", title: "Exam links expiring", body: "Maintenance Safety links expire in 6 days.", link: "/exams/exm_004", actor: "System", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "120,000 RWF recorded for Kaze Nsabimana via MoMo.", link: "/payments", actor: "Sandrine Uwimana", unread: false },
  { type: "trainee.enrolled", title: "New trainee", body: "Aline Mukamana enrolled 3 trainees in the Fire Safety Level 1 resit cohort.", link: "/trainees", actor: "Aline Mukamana", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Laurence Ingabire submitted Safe Driving & Fleet Safety with 88%.", link: "/exams", actor: "Laurence Ingabire", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "85,000 RWF recorded for Hillary Mutesi via card.", link: "/payments", actor: "Aline Mukamana", unread: false },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00003 issued to Théoneste Bizimana.", link: "/certificates", actor: "Eric Mugisha", unread: false },
  { type: "deadline.approaching", title: "Deadlines approaching", body: "Electrical Safety cohort 9 closes its window in 2 days.", link: "/exams/exm_003", actor: "System", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Ruhara Byumugisha submitted Fire Safety Level 1 with 74%.", link: "/exams/exm_001", actor: "Ruhara Byumugisha", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "210,000 RWF recorded for Solange Habimana via bank transfer.", link: "/payments", actor: "Sandrine Uwimana", unread: false },
  { type: "trainee.enrolled", title: "New trainee", body: "Christian Nsabimana enrolled in Fire Safety Level 1.", link: "/trainees", actor: "Aline Mukamana", unread: false },
  { type: "certificate.issued", title: "Certificate issued", body: "Certificate KSA-CERT-2026-00015 issued to Jean Claude Uwimana.", link: "/certificates", actor: "Jean Bosco Nsengimana", unread: false },
  { type: "exam.submitted", title: "Exam submitted", body: "Denise Umulisa submitted First Aid & CPR with 94%.", link: "/exams/exm_002", actor: "Denise Umulisa", unread: false },
  { type: "payment.recorded", title: "Payment recorded", body: "78,000 RWF recorded for Timothee Uwera via MoMo.", link: "/payments", actor: "Front desk — Solange I.", unread: false },
];

function build(): AppNotification[] {
  const rnd = seededFromString("ksa-notifications-v1");
  return seeds.map((s, i) => ({
    id: `ntf_${String(i + 1).padStart(3, "0")}`,
    type: s.type,
    title: s.title,
    body: s.body ?? "",
    createdAt: subMinutes(
      MOCK_NOW,
      Math.floor(rnd() * 2_880) + 2,
    ).toISOString(),
    read: !s.unread,
    mention: s.mention ?? false,
    link: s.link,
    actorName: s.actor,
  }));
}

export const notifications: AppNotification[] = build().sort((a, b) =>
  b.createdAt.localeCompare(a.createdAt),
);

export const notificationById = new Map(notifications.map((n) => [n.id, n]));

export const UNREAD_COUNT = notifications.filter((n) => !n.read).length;
export const READ_COUNT = notifications.filter((n) => n.read).length;
