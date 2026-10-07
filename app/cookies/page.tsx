import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";
import { ACADEMY } from "@/lib/academy/constants";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "The essential cookies Kigali Safety Academy sets — a sign-in session, security tokens and theme choice. No tracking cookies.",
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

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" updated="October 2026">
      <Section title="What cookies are">
        <p>
          Cookies are small text files a website stores on your device so it can remember
          things about your visit. {ACADEMY.shortName} uses a small, strictly defined set of
          them, all of which are essential to running the service.
        </p>
      </Section>

      <Section title="The cookies we set">
        <p>
          {ACADEMY.shortName} sets only essential cookies and local storage:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Session cookies</strong> — keep you signed in while
            you use the service and protect your session from tampering.
          </li>
          <li>
            <strong className="text-ink">Security tokens</strong> — a short-lived token that
            verifies forms are submitted from our own site (CSRF protection).
          </li>
          <li>
            <strong className="text-ink">Theme preference</strong> — stored locally so your
            light or dark setting survives a reload.
          </li>
          <li>
            <strong className="text-ink">Consent record</strong> — your choice on this banner,
            stored locally so you are not asked again.
          </li>
        </ul>
        <p>
          No advertising, analytics or other tracking cookies are set, and none are used by
          our email or hosting providers for advertising.
        </p>
      </Section>

      <Section title="Managing cookies">
        <p>
          You can refuse or clear cookies in your browser&rsquo;s settings at any time.
          Because our cookies are essential, some parts of the service (signing in, for
          example) need them to work — clearing them simply means you will need to sign in
          again.
        </p>
      </Section>

      <Section title="Your consent">
        <p>
          On your first visit you can accept or choose essential-only; either choice becomes
          your saved consent record. Standard browser privacy tools will always let you
          review or delete that record.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about cookies can be sent to the academy using the contact details
          published on this site.
        </p>
      </Section>
    </LegalPage>
  );
}