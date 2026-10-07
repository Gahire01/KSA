import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";
import { ACADEMY } from "@/lib/academy/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <Section title="The service">
        <p>
          {ACADEMY.name} ({ACADEMY.shortName}) operates a training, examination and
          certification platform. Trainees enrol in courses and sit exams; qualified staff
          manage enrolments, issue certificates and keep audit records. These terms apply to
          every use of the platform and its public verification service.
        </p>
      </Section>

      <Section title="Accounts and credentials">
        <p>
          Staff use an account issued by the academy. You are responsible for keeping your
          credentials confidential and for activity under your account. Sign-in codes are
          valid for a short period only — never share them. Notify the academy immediately if
          you believe your account has been compromised.
        </p>
      </Section>

      <Section title="Enrolment and fees">
        <p>
          Fees are set per course and agreed at enrolment. A course fee may be paid in full
          or in part; the balance and payment terms are shown at enrolment and on the
          trainee&rsquo;s record. Refunds are handled under our refund policy.
        </p>
      </Section>

      <Section title="Exams and certificates">
        <p>
          Exams are issued with a deadline and a single-use access code. Certificates are
          awarded only against a passed exam on a valid enrolment. Issued certificates can be
          independently verified through the public verification service, and may be revoked
          in the circumstances set out in the privacy policy.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          You agree not to misuse the platform: no sharing of exam codes, no attempts to
          break or probe security controls, no bulk extraction of records you are not
          authorised to see, and no use that disrupts other users or violates {ACADEMY.country}
          law.
        </p>
      </Section>

      <Section title="Intellectual property">
        <p>
          The platform, its course materials and its design belong to the academy or its
          licensors. Nothing here grants you any right to copy them beyond normal use of the
          service.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          The platform is provided to a professional standard, but to the extent the law
          allows we are not liable for indirect or consequential loss. Nothing in these terms
          limits liability that cannot be limited by law.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          The academy may suspend or close an account that breaches these terms or that
          threatens the integrity of certification. You may stop using the service at any
          time, subject to legitimate record-keeping obligations.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of the Republic of {ACADEMY.country}. Any
          dispute will be subject to the jurisdiction of the courts of {ACADEMY.city}.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms can be sent to the academy using the contact details
          published on this site.
        </p>
      </Section>
    </LegalPage>
  );
}