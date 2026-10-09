"use client";

import * as React from "react";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "Export" button: Excel or PDF, never CSV. It points at the session-gated
 * /api/reports/:type endpoint with the page's current filters, so the file matches
 * what is on screen.
 */

export type ExportType = "trainee-roster" | "payments" | "exam-results" | "certificate-register" | "audit-log";

export function exportUrl(type: ExportType, format: "xlsx" | "pdf", params: Record<string, string | string[] | undefined> = {}) {
  const query = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(","));
    } else if (value) {
      query.set(key, value);
    }
  }
  return `/api/reports/${type}?${query.toString()}`;
}

export function ExportMenu({
  type,
  params,
  label = "Export",
  disabled,
}: {
  type: ExportType;
  params?: Record<string, string | string[] | undefined>;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled}>
          <DownloadIcon className="size-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={exportUrl(type, "xlsx", params)} download>
            <FileSpreadsheetIcon className="size-4" />
            Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={exportUrl(type, "pdf", params)} download>
            <FileTextIcon className="size-4" />
            PDF
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
