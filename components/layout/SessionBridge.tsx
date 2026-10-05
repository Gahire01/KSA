"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { ROUTE_ACCESS, useAuthStore } from "@/lib/stores/auth-store";
import type { CurrentUser, Role } from "@/lib/types";

/**
 * Pushes the server-verified session into the Zustand store so client
 * components (sidebar, top bar, command palette) know who is signed in.
 *
 * Renders nothing. The server layout has already authorised the request, so this
 * is presentation only — the store never decides access.
 */
export function SessionBridge({
  user,
  mfaPassed,
}: {
  user: CurrentUser;
  mfaPassed: boolean;
}) {
  const setSession = useAuthStore((s) => s.setSession);
  const pathname = usePathname() ?? "/dashboard";

  React.useEffect(() => {
    setSession(user, mfaPassed);
  }, [user, mfaPassed, setSession]);

  /* Deny a role the route does not allow, in place, without a round trip. */
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const allowed: Role[] | undefined = ROUTE_ACCESS[segment];

  if (allowed && !allowed.includes(user.role)) {
    return <RoleNotice segment={segment} role={user.role} />;
  }

  return null;
}

function RoleNotice({ segment, role }: { segment: string; role: Role }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 px-4">
      <div className="max-w-md space-y-2 rounded-lg border border-line bg-card p-6 text-center shadow-lg">
        <h1 className="font-display text-lg font-semibold text-ink">
          You don&rsquo;t have access to this area
        </h1>
        <p className="text-sm text-ink-2">
          Your <span className="font-medium">{role.toLowerCase()}</span> role does not
          include <span className="font-mono text-xs">{segment}</span>.
        </p>
        <a
          href="/dashboard"
          className="inline-block rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}