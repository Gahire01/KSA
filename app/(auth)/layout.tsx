import type { Metadata } from "next";

import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ShieldCheckIcon, Clock3Icon, FileCheckIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const HIGHLIGHTS = [
  {
    icon: ShieldCheckIcon,
    title: "Safety-first records",
    body: "Every enrolment, exam and certificate is traceable end to end.",
  },
  {
    icon: Clock3Icon,
    title: "Deadlines you can trust",
    body: "Renewal windows surface before a certificate lapses, not after.",
  },
  {
    icon: FileCheckIcon,
    title: "Audit-ready by default",
    body: "Immutable activity history for every record change and payment.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — hidden on small screens to keep the form focused. */}
      <aside className="relative hidden overflow-hidden bg-navy px-10 py-12 text-sidebar-foreground lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #ffffff 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, #ffffff 0 1px, transparent 1px 14px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-orange/20 blur-3xl"
        />

        <div className="relative">
          <Logo size={40} wordmarkClassName="text-white text-[15px]" />
        </div>

        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-3xl leading-tight font-semibold text-white">
            Training and certification, handled.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Kigali Safety Academy&rsquo;s operations console for courses, exams,
            certificates and payments — built for the way a safety school
            actually runs.
          </p>

          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10"
                  >
                    <Icon className="size-4 text-orange" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-white/55">
                      {item.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-white/35">
          Kigali, Rwanda · est. 2019 · ISO 45001 aligned
        </p>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-dvh flex-col bg-paper outline-none"
      >
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <div className="lg:hidden">
            <Logo size={32} />
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <div className="px-6 pb-6 text-center text-xs text-ink-3">
          <p>Kigali Safety Academy · KN 07/MIN/EDUC/2024</p>
        </div>
      </main>
    </div>
  );
}
