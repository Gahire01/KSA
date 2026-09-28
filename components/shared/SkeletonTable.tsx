import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

/** Placeholder table used while a route's first query is in flight. */
export function SkeletonTable({
  rows = 8,
  cols = 6,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-line bg-card shadow-sm", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading table"
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-3 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r} className="hover:bg-transparent">
              {Array.from({ length: cols }).map((_, c) => (
                <TableCell key={c}>
                  <Skeleton
                    className={cn(
                      "h-4",
                      c === 0 ? "w-44" : c === 1 ? "w-24" : "w-16",
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
