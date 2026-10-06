"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BanIcon,
  CopyIcon,
  KeyRoundIcon,
  LinkIcon,
  MonitorSmartphoneIcon,
  PlusIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/utils/format";

/**
 * /access — who can get in, and on how many devices.
 *
 * Owner-only, matching the `access.manage` and `device.manage` grants. Minting a way
 * into the system is the most privileged action here, so the page is deliberately not
 * a general "team settings" screen: it shows links, referral codes and devices, and
 * nothing else.
 *
 * The plaintext link exists only in the response to the mint that created it. It is
 * shown once, in a panel the owner must acknowledge, and there is no way to get it
 * back — see `lib/auth/access-links.ts` for why that is the property worth having.
 */

type LinkStatus = "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";

interface AccessLinkRow {
  id: string;
  referralCode: string;
  role: "ADMIN" | "TRAINER";
  trainerId: string | null;
  label: string | null;
  expiresAt: string;
  singleUse: boolean;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { name: string | null; email: string };
  status: LinkStatus;
  _count: { devices: number; sessions: number };
}

interface ReferralRow {
  id: string;
  code: string;
  role: "ADMIN" | "TRAINER";
  trainerId: string | null;
  maxUses: number;
  timesUsed: number;
  remaining: number;
  expiresAt: string;
  status: "ACTIVE" | "USED" | "EXPIRED";
}

interface DeviceRow {
  id: string;
  label: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  status: "ACTIVE" | "REVOKED";
  current: boolean;
  viaLink: string | null;
}

interface MintedLink {
  id: string;
  url: string;
  token: string;
  referralCode: string;
  expiresAt: string;
  singleUse: boolean;
}

const STATUS_LABEL: Record<LinkStatus | ReferralRow["status"], string> = {
  ACTIVE: "Active",
  USED: "Used",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

export default function AccessControlPage() {
  const queryClient = useQueryClient();

  const [role, setRole] = React.useState<"ADMIN" | "TRAINER">("TRAINER");
  const [label, setLabel] = React.useState("");
  const [singleUse, setSingleUse] = React.useState(true);
  const [expiresInDays, setExpiresInDays] = React.useState("14");
  const [minted, setMinted] = React.useState<MintedLink | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<AccessLinkRow | null>(null);

  const linksQuery = useQuery({
    queryKey: ["access-links"],
    queryFn: () => api.get<{ items: AccessLinkRow[] }>("/access-links", { all: 1 }),
  });

  const referralsQuery = useQuery({
    queryKey: ["referral-codes"],
    queryFn: () => api.get<{ items: ReferralRow[] }>("/referral-codes", { all: 1 }),
  });

  const devicesQuery = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.get<{ items: DeviceRow[]; maxDevices: number; activeCount: number }>("/devices"),
  });

  const mintMutation = useMutation({
    mutationFn: () =>
      api.post<MintedLink>("/access-links", {
        role,
        label: label.trim() || null,
        singleUse,
        expiresInDays: Number.parseInt(expiresInDays, 10),
      }),
    onSuccess: (data) => {
      /* Held in state only. There is no second chance to see it. */
      setMinted(data);
      setLabel("");
      toast.success("Invitation link created", {
        description: "Copy it now — it cannot be shown again.",
      });
      void queryClient.invalidateQueries({ queryKey: ["access-links"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the link."),
  });

  const referralMutation = useMutation({
    mutationFn: () =>
      api.post<{ code: string }>("/referral-codes", {
        role,
        maxUses: 10,
        expiresInDays: 90,
      }),
    onSuccess: (data) => {
      toast.success(`Referral code ${data.code} created`);
      void queryClient.invalidateQueries({ queryKey: ["referral-codes"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the code."),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/access-links/${id}/revoke`),
    onSuccess: () => {
      toast.success("Link revoked", {
        description: "Any session and device it created has been signed out too.",
      });
      setRevokeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["access-links"] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not revoke the link."),
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: (id: string) => api.post(`/devices/${id}/revoke`),
    onSuccess: () => {
      toast.success("Device signed out");
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not sign that device out."),
  });

  const links = linksQuery.data?.items ?? [];
  const referrals = referralsQuery.data?.items ?? [];
  const devices = devicesQuery.data;
  const activeDevices = devices?.items.filter((d) => d.status === "ACTIVE") ?? [];
  const capReached = devices ? activeDevices.length >= devices.maxDevices : false;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Access control"
        subtitle="Invitation links, referral codes and the devices signed in to your account."
      />

      {/* ── The one-time link, held in memory only ───────────────────── */}
      {minted ? (
        <Card className="border-green/40 bg-green-bg">
          <CardHeader className="gap-1">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlertIcon className="size-4 text-green" />
              Copy this link now
            </CardTitle>
            <CardDescription>
              This is the only time it will ever be shown. Only a one-way hash is stored,
              so nobody — including you — can recover it later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
              <LinkIcon className="size-3.5 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
                {minted.url}
              </span>
              <CopyButton
                value={minted.url}
                label="link"
                size={15}
                toastMessage="Invitation link copied"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
              <CopyIcon className="size-3.5 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">
                Referral code {minted.referralCode}
              </span>
              <CopyButton
                value={minted.referralCode}
                label="code"
                size={15}
                toastMessage="Referral code copied"
              />
            </div>
            <p className="text-xs text-ink-2">
              Expires {formatDate(minted.expiresAt)} ·{" "}
              {minted.singleUse ? "single use" : "reusable until revoked or expired"}.
            </p>
            <Button size="sm" variant="outline" onClick={() => setMinted(null)}>
              I have copied it
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Mint ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base flex items-center gap-2">
            <PlusIcon className="size-4 text-ink-2" />
            New invitation link
          </CardTitle>
          <CardDescription>
            Creates an account for the named role. The recipient sets their own password
            and must enrol a second factor before they can see anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="access-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "ADMIN" | "TRAINER")}>
                <SelectTrigger id="access-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRAINER">Trainer</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-label">Label (optional)</Label>
              <Input
                id="access-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Ruby's cohort"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-days">Expires in (days)</Label>
              <Input
                id="access-days"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-single">Use limit</Label>
              <Select
                value={singleUse ? "single" : "multi"}
                onValueChange={(v) => setSingleUse(v === "single")}
              >
                <SelectTrigger id="access-single">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single use</SelectItem>
                  <SelectItem value="multi">Reusable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-ink-3">
            An owner link cannot be created here. Handing out owner access is a manual,
            deliberate act on a single terminal — a link would make it a forwardable
            email attachment.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={mintMutation.isPending}
              onClick={() => mintMutation.mutate()}
            >
              <KeyRoundIcon className="size-4" />
              Create link
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={referralMutation.isPending}
              onClick={() => referralMutation.mutate()}
            >
              <PlusIcon className="size-4" />
              Referral code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Links ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Invitation links</CardTitle>
          <CardDescription>
            Tokens are stored as SHA-256 digests. The link itself is unrecoverable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linksQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : links.length === 0 ? (
            <EmptyState
              title="No invitation links yet"
              description="Create one above to bring a trainer or administrator in."
            />
          ) : (
            <ul className="divide-y divide-line">
              {links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="font-mono text-xs text-ink-2">{l.referralCode}</span>
                      {l.label ? <span className="truncate">{l.label}</span> : null}
                      <StatusBadge status={l.status} label={STATUS_LABEL[l.status]} />
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {l.role} · expires {formatDate(l.expiresAt)} ·{" "}
                      {l.singleUse ? "single use" : "reusable"} · {l._count.sessions} session(s)
                    </p>
                  </div>
                  {l.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-red"
                      onClick={() => setRevokeTarget(l)}
                    >
                      <BanIcon className="size-4" />
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Referral codes ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Referral codes</CardTitle>
          <CardDescription>
            Attribution only — a code cannot sign anybody in. Uses are enforced atomically,
            so the last remaining use cannot be claimed twice at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : referrals.length === 0 ? (
            <EmptyState title="No referral codes yet" description="Create one above." />
          ) : (
            <ul className="divide-y divide-line">
              {referrals.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="font-mono">{c.code}</span>
                      <StatusBadge status={c.status} label={STATUS_LABEL[c.status]} />
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {c.role} · {c.timesUsed} of {c.maxUses} used · expires{" "}
                      {formatDate(c.expiresAt)}
                    </p>
                  </div>
                  <CopyButton
                    value={c.code}
                    label="code"
                    size={15}
                    toastMessage="Referral code copied"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Devices ───────────────────────────────────────────────────── */}
      <Card className={capReached ? "border-amber/40" : undefined}>
        <CardHeader className="gap-1">
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorSmartphoneIcon className="size-4 text-ink-2" />
            Signed-in devices
          </CardTitle>
          <CardDescription>
            {devices
              ? `${activeDevices.length} of ${devices.maxDevices} in use. A sixth sign-in revokes the least recently used device rather than refusing the new one.`
              : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devicesQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !devices || devices.items.length === 0 ? (
            <EmptyState title="No devices recorded" />
          ) : (
            <ul className="divide-y divide-line">
              {devices.items.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {d.label}
                      {d.current ? (
                        <span className="rounded-full bg-green-bg px-2 py-0.5 text-[10px] font-medium text-green">
                          This device
                        </span>
                      ) : null}
                      {d.status === "REVOKED" ? (
                        <StatusBadge status="REVOKED" label="Revoked" />
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-3">
                      {d.userAgent ?? "Unknown device"}
                      {d.ipAddress ? ` · ${d.ipAddress}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      Last seen {formatDateTime(d.lastSeenAt)}
                      {d.viaLink ? ` · via ${d.viaLink}` : ""}
                    </p>
                  </div>
                  {d.status === "ACTIVE" && !d.current ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-red"
                      disabled={revokeDeviceMutation.isPending}
                      onClick={() => revokeDeviceMutation.mutate(d.id)}
                    >
                      <BanIcon className="size-4" />
                      Sign out
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-ink-3">
        Revoking a link ends every session and device it created, so a withdrawn
        invitation cannot leave somebody signed in.{" "}
        <Link href="/audit-log" className="underline">
          See the audit log
        </Link>
        .
      </p>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this invitation link?"
        description="Any session and device created through it will be signed out immediately. The record is kept for audit."
        confirmLabel="Revoke link"
        destructive
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeMutation.mutateAsync(revokeTarget.id);
          } catch {
            /* handled in onError */
          }
        }}
      />
    </div>
  );
}
