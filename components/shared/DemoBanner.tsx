import * as React from "react";
import { FlaskConicalIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Marks the parts of the app that are still fed by the Phase 0 mock service.
 *
 * Phase 1 replaces trainees, courses, categories and authentication with real
 * database reads and writes. Everything else — exams, payments, certificates,
 * reports, trainers, audit log, settings — is still in-memory demo data, and
 * this banner is the honest label on those surfaces.
 */
export function DemoBanner({
  children,
  title = "Demo data",
  className,
}: {
  children?: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "no-print flex items-start gap-2.5 rounded-lg border border-transparent bg-amber-bg px-3.5 py-2.5",
        className,
      )}
    >
      <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
      <p className="min-w-0 text-xs leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{title}.</span>{" "}
        {children ??
          "This page still reads from the bundled mock service. Nothing here is stored in the database."}
      </p>
    </div>
  );
}