"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircleIcon, ShieldXIcon } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTE_ACCESS, canAccess, useAuthStore } from "@/lib/stores/auth-store";
import type { Role } from "@/lib/types";

/**
 * Client-side session + role gate for the authenticated area.
 *
 * The demo stores its session in Zustand (localStorage), so the guard runs on
 * the client and shows a brief checking state before deciding.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [ready, setReady] = React.useState(false);

  /* Wait one tick for zustand's persist rehydration. */
  React.useEffect(() => {
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    if (!currentUser) router.replace("/login");
  }, [ready, currentUser, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Restoring your session…
        </p>
      </div>
    );
  }

  if (!currentUser) return null;

  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const allowed: Role[] | undefined = ROUTE_ACCESS[segment];

  if (allowed && !allowed.includes(currentUser.role)) {
    return <AccessDenied segment={segment} role={currentUser.role} />;
  }

  if (!canAccess(currentUser.role, segment)) {
    return <AccessDenied segment={segment} role={currentUser.role} />;
  }

  return <>{children}</>;
}

function AccessDenied({ segment, role }: { segment: string; role: Role }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-amber-bg"
          >
            <ShieldXIcon className="size-5 text-amber" />
          </span>
          <div className="space-y-1">
            <h1 className="font-display text-lg font-semibold text-ink">
              You don&rsquo;t have access to this area
            </h1>
            <p className="text-sm text-ink-2">
              Your <span className="font-medium">{role.toLowerCase()}</span> role does
              not include <span className="font-mono text-xs">{segment}</span>. Ask
              an administrator if you think this is wrong.
            </p>
          </div>
          <Button asChild size="sm" className="mt-1">
            <a href="/dashboard">Back to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>
        <ErrorBoundary label="Page failed to render">{children}</ErrorBoundary>
      </AppShell>
    </AuthGuard>
  );
}
