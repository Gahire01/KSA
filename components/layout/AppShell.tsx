"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SidebarNav } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUiStore } from "@/lib/stores/ui-store";
import { useNotificationHydration, useNotificationStream } from "@/lib/hooks/use-notification-stream";
import { cn } from "@/lib/utils/cn";

/**
 * Authenticated application chrome: collapsible desktop sidebar, sticky topbar,
 * slide-over mobile navigation, command palette (⌘K) and the live notification
 * stream.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const pushRecentPage = useUiStore((s) => s.pushRecentPage);

  useNotificationHydration(true);
  useNotificationStream(true);

  /* ⌘K / Ctrl+K opens the palette, "/" is reserved by page search fields. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandPaletteOpen]);

  /* Remember visited pages for the palette's "Recent" group. */
  React.useEffect(() => {
    pushRecentPage(pathname, pathLabel(pathname));
  }, [pathname, pushRecentPage]);

  return (
    <div className="flex min-h-dvh bg-paper">
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 overflow-hidden transition-[width] duration-200 ease-out lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarNav />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-72 border-r border-line bg-navy p-0 lg:hidden"
          aria-label="Navigation"
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-7 print:px-0 print:py-0"
        >
          {children}
        </main>

        <footer className="no-print border-t border-line px-4 py-4 text-xs text-ink-3 sm:px-6 lg:px-8">
          <p>
            Kigali Safety Academy · Trainees and courses are backed by the live
            database · Other sections still show demo data.
          </p>
        </footer>
      </div>

      <CommandPalette />
    </div>
  );
}

function pathLabel(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/trainees": "Trainees",
    "/courses": "Courses",
    "/exams": "Exams",
    "/certificates": "Certificates",
    "/payments": "Payments",
    "/trainers": "Trainers",
    "/reports": "Reports",
    "/audit-log": "Audit log",
    "/settings": "Settings",
  };
  return map[pathname] ?? pathname;
}
