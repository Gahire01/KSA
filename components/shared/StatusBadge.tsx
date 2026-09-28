"use client";

import * as React from "react";
import {
  BanIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  ClockIcon,
  FileEditIcon,
  HourglassIcon,
  LoaderIcon,
  MinusCircleIcon,
  PenLineIcon,
  PlayCircleIcon,
  SendIcon,
  TimerIcon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { titleCase } from "@/lib/utils/format";

export type StatusValue =
  | "paid"
  | "partial"
  | "unpaid"
  | "active"
  | "pending"
  | "completed"
  | "suspended"
  | "expired"
  | "revoked"
  | "passed"
  | "failed"
  | "valid"
  | "expiring"
  | "sent"
  | "started"
  | "submitted"
  | "void"
  | "not_sent"
  | "draft"
  | "scheduled";

interface Mapping {
  label: string;
  variant: "green" | "amber" | "red" | "neutral" | "orange" | "default" | "outline";
  Icon: React.ComponentType<{ className?: string }>;
}

const MAP: Record<StatusValue, Mapping> = {
  paid: { label: "Paid", variant: "green", Icon: CheckCircle2Icon },
  partial: { label: "Partial", variant: "amber", Icon: MinusCircleIcon },
  unpaid: { label: "Unpaid", variant: "red", Icon: WalletIcon },
  active: { label: "Active", variant: "green", Icon: PlayCircleIcon },
  pending: { label: "Pending", variant: "amber", Icon: HourglassIcon },
  completed: { label: "Completed", variant: "green", Icon: CheckCircle2Icon },
  suspended: { label: "Suspended", variant: "red", Icon: BanIcon },
  expired: { label: "Expired", variant: "red", Icon: ClockIcon },
  revoked: { label: "Revoked", variant: "red", Icon: XCircleIcon },
  passed: { label: "Passed", variant: "green", Icon: CheckCircle2Icon },
  failed: { label: "Failed", variant: "red", Icon: XCircleIcon },
  valid: { label: "Valid", variant: "green", Icon: CheckCircle2Icon },
  expiring: { label: "Expiring soon", variant: "amber", Icon: ClockIcon },
  sent: { label: "Link sent", variant: "neutral", Icon: SendIcon },
  not_sent: { label: "Not sent", variant: "neutral", Icon: CircleSlashIcon },
  started: { label: "Started", variant: "amber", Icon: LoaderIcon },
  submitted: { label: "Submitted", variant: "neutral", Icon: FileEditIcon },
  void: { label: "Void", variant: "red", Icon: CircleSlashIcon },
  draft: { label: "Draft", variant: "outline", Icon: PenLineIcon },
  scheduled: { label: "Scheduled", variant: "orange", Icon: TimerIcon },
};

const DOMAIN_TO_STATUS: Record<string, StatusValue> = {
  PAID: "paid",
  PARTIAL: "partial",
  UNPAID: "unpaid",
  ACTIVE: "active",
  ENROLLED: "active",
  IN_PROGRESS: "pending",
  PENDING: "pending",
  COMPLETED: "completed",
  SUSPENDED: "suspended",
  EXPIRED: "expired",
  REVOKED: "revoked",
  PASSED: "passed",
  FAILED: "failed",
  VALID: "valid",
  EXPIRING: "expiring",
  SENT: "sent",
  STARTED: "started",
  SUBMITTED: "submitted",
  VOID: "void",
  NOT_SENT: "not_sent",
  DRAFT: "draft",
  SCHEDULED: "scheduled",
};

export function resolveStatus(value: string): StatusValue {
  const upper = value.toUpperCase();
  return DOMAIN_TO_STATUS[upper] ?? "pending";
}

export function StatusBadge({
  status,
  label,
  className,
  size = "default",
}: {
  status: StatusValue | string;
  label?: string;
  className?: string;
  size?: "default" | "sm";
}) {
  const key = (DOMAIN_TO_STATUS[String(status).toUpperCase()] ?? status.toLowerCase()) as StatusValue;
  const mapping = MAP[key] ?? MAP.pending;
  const { Icon } = mapping;
  return (
    <Badge variant={mapping.variant} size={size} className={cn("font-medium", className)}>
      <Icon className="size-3 shrink-0" />
      {label ?? mapping.label}
    </Badge>
  );
}

export { MAP as STATUS_META, titleCase };
