"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GlobeIcon,
  LoaderIcon,
  LogOutIcon,
  MonitorIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDateTime, formatRelative } from "@/lib/utils/format";

/**
 * /settings/profile — the signed-in account and, for the owner, every session
 * live on it.
 *
 * The session list is deliberately owner-only in the UI: a team member's own
 * devices are already covered by /settings/devices, and the owner asked for one
 * place to see everything signed in as them. The API behind it is self-scoped
 * regardless, so the gate here is presentation, not security.
 */

interface SessionRow {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string | null;
  location: string | null;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isOwner = currentUser?.role === "OWNER";
  const [revokeTarget, setRevokeTarget] = React.useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: () => api.get<{ items: SessionRow[] }>("/auth/sessions"),
    enabled: isOwner,
    refetchOnWindowFocus: true,
  });

  const revokeOne = useMutation({
    mutationFn: (id: string) => api.delete<{ revoked: boolean }>(`/auth/sessions/${id}`),
    onSuccess: () => {
      setRevokeTarget(null);
      toast.success("Session signed out");
      void queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not sign that session out."),
  });

  const revokeOthers = useMutation({
    mutationFn: () => api.post<{ revoked: number }>("/auth/sessions/revoke-others"),
    onSuccess: (result) => {
      toast.success(
        result.revoked === 0
          ? "No other sessions were open"
          : `Signed out ${result.revoked} other session${result.revoked === 1 ? "" : "s"}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["auth-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not sign out the other sessions."),
  });

  const sessions = sessionsQuery.data?.items ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profile"
        subtitle="Your account, and every browser currently signed in as you."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription>
                Sign-in details for this account. Ask the owner to change them.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <AvatarInitials name={currentUser?.name ?? "?"} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-ink">
                  {currentUser?.name}
                </p>
                <p className="truncate text-sm text-ink-2">{currentUser?.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{currentUser?.role}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                    <ShieldCheckIcon className="size-3.5" />
                    Signed in with a emailed one-time code
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isOwner ? (
            <Card>
              <CardHeader className="gap-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <MonitorIcon className="size-4 text-ink-2" />
                  Sessions
                </CardTitle>
                <CardDescription>
                  Signed in on {sessions.length} browser{sessions.length === 1 ? "" : "s"}. Signing
                  out one does not affect the others.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessionsQuery.isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-ink-2">No active sessions.</p>
                ) : (
                  <>
                    {sessions.map((session) => (
                      <div key={session.id} className="rounded-lg border border-line px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {session.device}
                            </p>
                            <p className="truncate text-xs text-ink-2">
                              {session.browser} · {session.os} ·{" "}
                              {session.location ?? session.ip ?? "Unknown place"}
                            </p>
                          </div>
                          {session.current ? (
                            <Badge variant="green">This device</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Sign out ${session.device}`}
                              onClick={() => setRevokeTarget(session.id)}
                            >
                              <LogOutIcon className="size-4" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-ink-3">
                          Last seen {formatRelative(session.lastSeenAt)} ·{" "}
                          {formatDateTime(session.lastSeenAt)}
                          {session.ip ? ` · ${session.ip}` : ""}
                        </p>
                      </div>
                    ))}

                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={otherCount === 0 || revokeOthers.isPending}
                        onClick={() => revokeOthers.mutate()}
                      >
                        {revokeOthers.isPending ? (
                          <LoaderIcon className="size-4 animate-spin" />
                        ) : (
                          <LogOutIcon className="size-4" />
                        )}
                        {otherCount === 0
                          ? "No other sessions"
                          : `Sign out all other sessions (${otherCount})`}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <GlobeIcon className="size-4 text-ink-2" />
                Session policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-ink-2">
              <p>
                With <span className="font-medium text-ink">Remember me</span> ticked at sign-in, a
                session lasts 30 days. Unticked, it lasts 12 hours.
              </p>
              <p>
                Every browser, PC and phone holds its own independent session — signing out on one
                never signs out the others.
              </p>
              <p className="text-xs text-ink-3">
                Each session is bound to the browser that created it; copying the cookie alone will
                not work.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {revokeTarget ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card p-4 shadow-lg sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:rounded-xl sm:border">
          <p className="mb-2 text-sm font-semibold text-ink">Sign out this session?</p>
          <p className="mb-3 text-xs text-ink-2">
            That browser will need to sign in again with a new one-time code.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              disabled={revokeOne.isPending}
              onClick={() => revokeTarget && revokeOne.mutate(revokeTarget)}
            >
              {revokeOne.isPending ? <LoaderIcon className="size-4 animate-spin" /> : null}
              Sign out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
