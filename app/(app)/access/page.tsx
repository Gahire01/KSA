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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  maxDevices: number;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { name: string | null; email: string };
  status: LinkStatus;
  /** `devices` counts only devices still admitted. */
  _count: { devices: number; sessions: number };
}

interface TrainerOption {
  id: string;
  name: string | null;
  email: string;
}

interface LinkDeviceRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  status: "ACTIVE" | "REMOVED";
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
  status: "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";
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
  maxDevices: number;
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
  const [singleUse, setSingleUse] = React.useState(false);
  const [expiresInHours, setExpiresInHours] = React.useState("24");
  const [maxDevices, setMaxDevices] = React.useState("5");
  const [trainerId, setTrainerId] = React.useState("");
  const [newTrainerName, setNewTrainerName] = React.useState("");
  const [newTrainerEmail, setNewTrainerEmail] = React.useState("");
  const [minted, setMinted] = React.useState<MintedLink | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<AccessLinkRow | null>(null);
  const [devicesLink, setDevicesLink] = React.useState<AccessLinkRow | null>(null);

  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: () => api.get<{ items: TrainerOption[] }>("/trainers"),
    staleTime: 60_000,
  });

  const linkDevicesQuery = useQuery({
    queryKey: ["link-devices", devicesLink?.id],
    queryFn: () =>
      api.get<{ items: LinkDeviceRow[]; activeCount: number }>(`/access-links/${devicesLink?.id}/devices`),
    enabled: Boolean(devicesLink),
  });

  const addTrainerMutation = useMutation({
    mutationFn: () => api.post<TrainerOption>("/trainers", { name: newTrainerName, email: newTrainerEmail }),
    onSuccess: (trainer) => {
      toast.success("Trainer added");
      setTrainerId(trainer.id);
      setNewTrainerName("");
      setNewTrainerEmail("");
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not add the trainer."),
  });

  const removeLinkDeviceMutation = useMutation({
    mutationFn: (v: { linkId: string; deviceId: string }) =>
      api.post(`/access-links/${v.linkId}/devices/${v.deviceId}/revoke`),
    onSuccess: () => {
      toast.success("Device removed");
      void queryClient.invalidateQueries({ queryKey: ["link-devices"] });
      void queryClient.invalidateQueries({ queryKey: ["access-links"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not remove that device."),
  });

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
        label: label.trim(),
        ...(role === "TRAINER" ? { trainerId } : {}),
        singleUse,
        expiresInHours: Number.parseInt(expiresInHours, 10),
        maxDevices: Number.parseInt(maxDevices, 10),
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
        ...(role === "TRAINER" ? { trainerId } : {}),
        /* Each use is one device, and a code works on at most five. */
        maxUses: Number.parseInt(maxDevices, 10),
        expiresInDays: 7,
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

  const revokeReferralMutation = useMutation({
    mutationFn: (id: string) => api.post(`/referral-codes/${id}/revoke`),
    onSuccess: () => {
      toast.success("Code revoked", { description: "Anyone signed in with it has been signed out." });
      void queryClient.invalidateQueries({ queryKey: ["referral-codes"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not revoke the code."),
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
        title="Team access"
        subtitle="Links and codes that let your team open the dashboard without a password, and the devices using them."
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
              Expires {formatDateTime(minted.expiresAt)} · up to {minted.maxDevices} device
              {minted.maxDevices === 1 ? "" : "s"} ·{" "}
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
            New access link
          </CardTitle>
          <CardDescription>
            Whoever opens the link goes straight to the dashboard, with no password. It works on up to five
            devices and stops working when it expires or you revoke it.
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
              <Label htmlFor="access-label">Label</Label>
              <Input
                id="access-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Ruby's cohort"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-hours">Expires in (hours)</Label>
              <Input
                id="access-hours"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-devices">Max devices</Label>
              <Select value={maxDevices} onValueChange={setMaxDevices}>
                <SelectTrigger id="access-devices">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4", "5"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {role === "TRAINER" ? (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <div className="space-y-1.5">
                <Label htmlFor="access-trainer">Trainer</Label>
                <Select value={trainerId || "none"} onValueChange={(v) => setTrainerId(v === "none" ? "" : v)}>
                  <SelectTrigger id="access-trainer">
                    <SelectValue placeholder="Choose a trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a trainer</SelectItem>
                    {(trainersQuery.data?.items ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name ?? t.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ink-3">
                  The link opens a dashboard limited to this trainer&apos;s own courses and trainees.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="new-trainer-name">Or add a new trainer</Label>
                  <Input
                    id="new-trainer-name"
                    value={newTrainerName}
                    onChange={(e) => setNewTrainerName(e.target.value)}
                    placeholder="Full name"
                    maxLength={120}
                  />
                </div>
                <Input
                  value={newTrainerEmail}
                  onChange={(e) => setNewTrainerEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  maxLength={160}
                  aria-label="New trainer email"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={addTrainerMutation.isPending || newTrainerName.trim().length < 2 || !newTrainerEmail}
                  onClick={() => addTrainerMutation.mutate()}
                >
                  Add trainer
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-ink-3">
            An owner link cannot be created here. Handing out owner access is a manual,
            deliberate act on a single terminal — a link would make it a forwardable
            email attachment.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={
                mintMutation.isPending ||
                label.trim().length < 1 ||
                (role === "TRAINER" && !trainerId)
              }
              onClick={() => mintMutation.mutate()}
            >
              <KeyRoundIcon className="size-4" />
              Create link
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={referralMutation.isPending || (role === "TRAINER" && !trainerId)}
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
          <CardTitle className="text-base">Access links</CardTitle>
          <CardDescription>
            Only a one-way digest of each link is stored, so a link cannot be shown again after you
            create it. If one is lost, revoke it and make a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linksQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : links.length === 0 ? (
            <EmptyState
              title="No access links yet"
              description="Create one above to give a trainer or administrator access."
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
                      {l.role} · expires {formatDateTime(l.expiresAt)} ·{" "}
                      {l.singleUse ? "single use" : "reusable"} · devices {l._count.devices}/{l.maxDevices}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => setDevicesLink(l)}
                  >
                    <MonitorSmartphoneIcon className="size-4" />
                    Devices
                  </Button>
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
            A short code to type on the sign-in page instead of opening a link. Each use is one
            device, and a code works on at most five. Uses are counted atomically, so the last one
            cannot be claimed twice.
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
                  {c.status === "ACTIVE" || c.status === "USED" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-red"
                      disabled={revokeReferralMutation.isPending}
                      onClick={() => revokeReferralMutation.mutate(c.id)}
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

      {/* ── Devices ───────────────────────────────────────────────────── */}
      <Card className={capReached ? "border-amber/40" : undefined}>
        <CardHeader className="gap-1">
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorSmartphoneIcon className="size-4 text-ink-2" />
            Your own devices
          </CardTitle>
          <CardDescription>
            {devices
              ? `${activeDevices.length} signed in. As the owner you can sign in from any number of devices.`
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

      <Dialog open={Boolean(devicesLink)} onOpenChange={(open) => !open && setDevicesLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devices on this link</DialogTitle>
            <DialogDescription>
              {devicesLink?.label ?? devicesLink?.referralCode}: {linkDevicesQuery.data?.activeCount ?? "…"} of{" "}
              {devicesLink?.maxDevices} in use. Removing one frees its place and signs it out.
            </DialogDescription>
          </DialogHeader>
          {linkDevicesQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (linkDevicesQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-2">No device has opened this link yet.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {linkDevicesQuery.data?.items.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ink">{d.userAgent ?? "Unknown device"}</p>
                    <p className="text-xs text-ink-3">
                      {d.ipAddress ?? "unknown IP"} · last seen {formatDateTime(d.lastSeenAt)}
                    </p>
                  </div>
                  {d.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red"
                      disabled={removeLinkDeviceMutation.isPending}
                      onClick={() =>
                        devicesLink && removeLinkDeviceMutation.mutate({ linkId: devicesLink.id, deviceId: d.id })
                      }
                    >
                      Remove
                    </Button>
                  ) : (
                    <StatusBadge status="REVOKED" label="Removed" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this access link?"
        description="Everyone using it is signed out on their next click, and the link stops working. The record is kept for audit."
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
