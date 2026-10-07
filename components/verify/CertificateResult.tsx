import * as React from "react";
import {
  BadgeCheckIcon,
  CalendarIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicCertificate } from "@/lib/certificates/verify";
import { formatDate } from "@/lib/utils/format";

/**
 * The public verification result.
 *
 * Presentational and shared by `/verify/[token]` (server-rendered) and `/verify`
 * (search box), so a verified certificate looks identical however it was reached.
 *
 * It renders exactly the fields the public projection allows. There is no hash, no
 * email and no internal id to print here — the earlier mock page showed a content
 * hash, which would have told anyone holding a leaked token enough to confirm a
 * forged row.
 */

const STATUS_COPY: Record<
  PublicCertificate["status"],
  {
    heading: string;
    body: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    border: string;
  }
> = {
  VALID: {
    heading: "Authentic certificate",
    body: "This certificate was issued by Kigali Safety Academy and is currently valid.",
    icon: ShieldCheckIcon,
    tone: "text-green",
    border: "border-green/40",
  },
  REVOKED: {
    heading: "Revoked certificate",
    body: "This certificate was revoked by the academy. Treat it as invalid and contact us for details.",
    icon: ShieldXIcon,
    tone: "text-red",
    border: "border-red/40",
  },
};

export function CertificateResult({ cert }: { cert: PublicCertificate }) {
  const copy = STATUS_COPY[cert.status];
  const Icon = copy.icon;

  return (
    <Card className={copy.border}>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span
            className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-paper ${copy.tone}`}
            aria-hidden
          >
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-ink">{copy.heading}</h2>
            <p className="mt-1 text-sm text-ink-2">{copy.body}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
          <AvatarInitials name={cert.traineeName} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{cert.traineeName}</p>
            <p className="truncate font-mono text-xs text-ink-3">
              Student number {cert.studentNumber}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {cert.status}
          </Badge>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail
            icon={<GraduationCapIcon className="size-4" />}
            label="Course"
            value={cert.courseName}
            sub={cert.courseCode}
          />
          <Detail
            icon={<CalendarIcon className="size-4" />}
            label="Issued"
            value={formatDate(cert.issuedAt)}
          />
          <Detail
            icon={<BadgeCheckIcon className="size-4" />}
            label="Duration"
            value={cert.duration}
            sub={cert.topics.length > 0 ? cert.topics.join(" · ") : undefined}
          />
          <Detail
            icon={<GraduationCapIcon className="size-4" />}
            label="Trainer"
            value={cert.trainerName}
            sub={`${cert.trainerTitle}, Kigali Safety Academy`}
          />
          <Detail
            icon={<ShieldCheckIcon className="size-4" />}
            label="Signed by"
            value={cert.signerName}
            sub={`${cert.signerTitle}, Kigali Safety Academy`}
          />
        </dl>

        {cert.status === "REVOKED" && cert.revokedReason ? (
          <div className="space-y-1 rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
            <p className="font-medium">Revocation reason</p>
            <p>{cert.revokedReason}</p>
            {cert.revokedAt ? (
              <p className="text-xs opacity-80">Revoked {formatDate(cert.revokedAt)}</p>
            ) : null}
          </div>
        ) : null}

        <p className="border-t border-line pt-4 font-mono text-xs text-ink-3">
          Certificate no. {cert.studentNumber}
        </p>
      </CardContent>
    </Card>
  );
}

export function CertificateNotFound({ message }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-red-bg text-red"
          aria-hidden
        >
          <ShieldXIcon className="size-6" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            No certificate matches that code
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {message ??
              "Check for typing mistakes, or contact the academy if you believe the certificate is genuine."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-ink-3" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
          {label}
        </dt>
        <dd className="truncate text-sm font-medium text-ink">{value}</dd>
        {sub ? <dd className="truncate text-xs text-ink-3">{sub}</dd> : null}
      </div>
    </div>
  );
}
