"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { InstallButton } from "@/components/pwa/install-button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { buildBreadcrumbs } from "@/components/layout/breadcrumbs";
import { useUiStore } from "@/lib/stores/ui-store";

export function Topbar({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname() ?? "";
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openCommand = useUiStore((s) => s.setCommandPaletteOpen);

  const crumbs = React.useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  return (
    <header
      data-app="topbar"
      className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-card/85 px-3 backdrop-blur-md lg:px-5"
    >
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <MenuIcon className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
      >
        {collapsed ? (
          <PanelLeftOpenIcon className="size-4.5" />
        ) : (
          <PanelLeftCloseIcon className="size-4.5" />
        )}
      </Button>

      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex items-center gap-1.5 text-sm">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.href}-${i}`}>
                  {i > 0 && (
                    <li aria-hidden className="text-ink-3">
                      /
                    </li>
                  )}
                  <li
                    className={last ? "truncate font-medium text-ink" : "text-ink-2"}
                    aria-current={last ? "page" : undefined}
                  >
                    {last ? (
                      crumb.label
                    ) : (
                      <Link href={crumb.href} className="rounded hover:text-ink">
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>
        <div className="sm:hidden">
          <Logo showWordmark={false} size={28} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => openCommand(true)}
        className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none md:flex"
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
          ⌘K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => openCommand(true)}
        aria-label="Search"
      >
        <SearchIcon className="size-4.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 hidden h-6 sm:block" />

      <Button asChild size="sm" className="hidden gap-1.5 sm:inline-flex">
        <Link href="/trainees/new">
          <PlusIcon className="size-4" />
          New trainee
        </Link>
      </Button>

      <InstallButton />
      <ThemeToggle />
      <NotificationBell />
    </header>
  );
}
