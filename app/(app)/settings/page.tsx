"use client";

import Link from "next/link";
import {
  BarChart3Icon,
  FileClockIcon,
  KeyRoundIcon,
  PenLineIcon,
  TicketIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACADEMY, isPlaceholder } from "@/lib/academy/constants";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * /settings — where the academy's real settings live. Everything here is a working page;
 * the academy's own contact details are shown exactly as stored, with an explicit
 * marker (never an invented value) where the owner has not filled them in yet.
 */

const DETAILS: Array<[string, string]> = [
  ["Name", ACADEMY.name],
  ["Address", ACADEMY.address],
  ["Phone", ACADEMY.phone],
  ["Email", ACADEMY.email],
  ["Website", ACADEMY.website],
  ["Registration number", ACADEMY.registrationNumber],
];

const LINKS: Array<{
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"OWNER" | "ADMIN" | "TRAINER">;
}> = [
  { href: "/settings/profile", title: "Profile", description: "Your account and every browser signed in as you.", icon: UserIcon, roles: ["OWNER", "ADMIN", "TRAINER"] },
  { href: "/settings/signature", title: "Certificate signature", description: "Draw or upload the director's signature and lock it.", icon: PenLineIcon, roles: ["OWNER"] },
  { href: "/access", title: "Access links", description: "Give team members and trainers a way in.", icon: KeyRoundIcon, roles: ["OWNER"] },
  { href: "/settings/referrals", title: "Referral codes", description: "Short codes a team member types to sign in.", icon: TicketIcon, roles: ["OWNER"] },
  { href: "/trainers", title: "Trainers", description: "The people who run your courses.", icon: UsersIcon, roles: ["OWNER", "ADMIN"] },
  { href: "/audit-log", title: "Audit log", description: "The append-only record of every privileged action.", icon: FileClockIcon, roles: ["OWNER"] },
  { href: "/reports", title: "Reports", description: "Excel and PDF exports of your records.", icon: BarChart3Icon, roles: ["OWNER", "ADMIN"] },
];

export default function SettingsPage() {
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const links = LINKS.filter((l) => l.roles.includes(role));

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Your account, your team, and the academy's details." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-start gap-3 rounded-xl border border-line bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
          >
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-2">
              <l.icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{l.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">{l.description}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Academy details</CardTitle>
          <CardDescription>
            These appear on receipts, emails and the public pages. They are set in <code>lib/academy/constants.ts</code>;
            anything marked as unfilled has not been provided yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {DETAILS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm text-ink">
                  {value || "—"}
                  {isPlaceholder(value) ? <Badge variant="outline">Unfilled</Badge> : null}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
