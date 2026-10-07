import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";
import { ACADEMY } from "@/lib/academy/constants";

export const metadata: Metadata = {
  title: "Refund Policy",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" updated="October 2026">
      <Section title="Scope">
        <p>
          This policy covers course fees paid to {ACADEMY.name} ({ACADEMY.shortName}) for
          enrolment in a training course. Fees are normally paid in full or in part at
          enrolment; this policy explains when a refund is available.
        </p>
      </Section>

      <Section title="Before the course starts">
        <p>
          If a trainee withdraws before the course start date, the paid fees are refunded in
          full, less a small administrative charge to cover enrolment, record-keeping and
          payment processing. The charge is notified before the refund is processed.
        </p>
      </Section>

      <Section title="After the course starts">
        <p>
          If a trainee withdraws after the course has started but before an exam has been
          issued, the refund is pro-rated for the portion of the course not yet delivered,
          less the same administrative charge.
        </p>
      </Section>

      <Section title="After an exam has been issued">
        <p>
          Once an exam has been issued to a trainee, no refund is available: the exam access
          link is single-use and the failure window has opened. This also applies where a
          trainee does not sit an exam before its deadline.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Refund requests are made in writing through the contact details published on this
          site, quoting the trainee&rsquo;s name and enrolment number. Requests must reach us
          within 14 days of the withdrawal or of the payment, whichever is later.
        </p>
      </Section>

      <Section title="Processing">
        <p>
          Approved refunds are returned through the same method used for payment, or by bank
          transfer to an account you provide if that is not possible, normally within 10
          business days of approval.
        </p>
      </Section>
    </LegalPage>
  );
}