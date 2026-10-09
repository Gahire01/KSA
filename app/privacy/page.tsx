import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";
import { ACADEMY } from "@/lib/academy/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Kigali Safety Academy handles the personal data of trainees and staff: what is collected, why, and the rights you have over it.",
  robots: { index: true, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <Section title="Who we are">
        <p>
          {ACADEMY.name} ({ACADEMY.shortName}) provides training, examination and
          certification services from {ACADEMY.city}, {ACADEMY.country}. This policy
          explains what personal data the platform collects, why, and the rights you
          have over it.
        </p>
      </Section>

      <Section title="What we collect">
        <p>Depending on how you use the platform, we process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Enrolment records</strong> — name, email address,
            phone number and country of the trainee, plus course, fee and payment records.
          </li>
          <li>
            <strong className="text-ink">Exam results</strong> — answers submitted, scores
            and pass/fail outcome, which form the basis of certification.
          </li>
          <li>
            <strong className="text-ink">Staff accounts</strong> — name, email address and a
            password hash for the staff who operate the console.
          </li>
          <li>
            <strong className="text-ink">Technical data</strong> — audit-log entries recording
            who changed what record and when.
          </li>
        </ul>
      </Section>

      <Section title="Why we process it">
        <p>
          Every record is processed for a specific purpose: enrolment data to deliver the
          training you registered for, exam results to verify certification, and audit logs
          to keep certification trustworthy. Email addresses and phone numbers are used to
          send exam access links, certificates and deadline reminders. We do not sell
          personal data, and we do not use it for advertising.
        </p>
      </Section>

      <Section title="Legal basis">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Contract</strong> — processing needed to deliver the
            training, examination and certification you enrolled in.
          </li>
          <li>
            <strong className="text-ink">Legal obligation</strong> — keeping training and
            certification records that regulators require.
          </li>
          <li>
            <strong className="text-ink">Consent</strong> — where you are asked to confirm
            that a trainee&rsquo;s data may be stored, or for any optional messaging.
          </li>
        </ul>
      </Section>

      <Section title="Who we share it with">
        <p>
          Only what is strictly necessary, and only with: our hosting and email-delivery
          providers (to send exam links and certificates), and regulators or courts where
          the law requires it. No data is shared with advertisers.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Enrolment and exam records are kept for as long as the law requires training and
          certification records to be kept — typically several years after a course — because
          they prove who completed which certification and when. Certificates remain
          verifiable for their validity period. Audit logs are kept for a fixed period and
          then deleted.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You may request access to, correction of, or deletion of personal data we hold
          about you, and you may object to processing or ask for a copy in a portable
          format. To exercise any of these rights, contact the academy at the contact
          details published on this site. We will respond within the period the law allows
          and may need to verify your identity first.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If this policy changes, the revised version will be published here with its update
          date. Significant changes will be flagged to account holders.
        </p>
      </Section>
    </LegalPage>
  );
}