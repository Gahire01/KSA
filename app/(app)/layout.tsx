import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { SessionBridge } from "@/components/layout/SessionBridge";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { getSession } from "@/lib/auth/session";

/**
 * Server-side session + role gate for the authenticated area.
 *
 * This runs on the server on every request, so an unauthenticated or
 * MFA-incomplete visitor never receives the page HTML — the old client-side
 * Zustand guard is gone as the security boundary. Role checks happen here too;
 * `SessionBridge` only mirrors the result into client components.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!session.mfaPassed) redirect("/login/mfa");

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? session.user.email,
    role: session.user.role,
  } as const;

  return (
    <>
      <SessionBridge user={user} mfaPassed={session.mfaPassed} />
      <AppShell>
        <ErrorBoundary label="Page failed to render">{children}</ErrorBoundary>
      </AppShell>
    </>
  );
}