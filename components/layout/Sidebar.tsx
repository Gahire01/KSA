"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AwardIcon,
  BarChart3Icon,
  BookOpenIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileClockIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  PenLineIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
  UserIcon,
} from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useUiStore } from "@/lib/stores/ui-store";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles allowed to see this item. */
  roles?: ("OWNER" | "ADMIN" | "TRAINER")[];
}

export interface NavItemGroup {
  title?: string;
  items: NavItem[];
}

export interface NavSection {
  title: string;
  items?: NavItem[];
  groups?: NavItemGroup[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon }],
  },
  {
    title: "Trainees",
    groups: [
      {
        items: [
          { href: "/trainees", label: "All trainees", icon: UsersIcon },
          { href: "/trainees/new", label: "Add trainee", icon: UsersIcon },
          { href: "/trainees/import", label: "Import", icon: UsersIcon },
        ],
      },
    ],
  },
  {
    title: "Courses",
    groups: [
      {
        items: [
          { href: "/courses", label: "All courses", icon: BookOpenIcon },
          { href: "/courses/new", label: "Add course", icon: BookOpenIcon },
        ],
      },
    ],
  },
  {
    title: "Exams",
    groups: [
      {
        items: [
          { href: "/exams", label: "All exams", icon: ClipboardCheckIcon },
          { href: "/exams/new", label: "Send exam links", icon: ClipboardCheckIcon },
          { href: "/questions", label: "Question bank", icon: ClipboardCheckIcon },
        ],
      },
    ],
  },
  {
    title: "Certificates",
    groups: [
      {
        items: [
          { href: "/certificates", label: "All certificates", icon: AwardIcon },
          { href: "/certificates/issue", label: "Issue certificate", icon: AwardIcon },
          { href: "/verify", label: "Verify (public)", icon: AwardIcon },
        ],
      },
    ],
  },
  {
    title: "Payments",
    groups: [
      {
        items: [
          { href: "/payments", label: "All payments", icon: CreditCardIcon, roles: ["OWNER", "ADMIN"] },
          { href: "/payments/new", label: "Record payment", icon: CreditCardIcon, roles: ["OWNER", "ADMIN"] },
        ],
      },
    ],
  },
  {
    title: "Team",
    groups: [
      {
        items: [
          { href: "/trainers", label: "Trainers", icon: ShieldCheckIcon, roles: ["OWNER", "ADMIN"] },
          { href: "/access", label: "Access links", icon: KeyRoundIcon, roles: ["OWNER"] },
          { href: "/devices", label: "Devices", icon: KeyRoundIcon, roles: ["OWNER"] },
        ],
      },
    ],
  },
  {
    title: "Data",
    groups: [
      {
        items: [
          { href: "/reports", label: "Reports", icon: BarChart3Icon, roles: ["OWNER", "ADMIN"] },
          { href: "/audit-log", label: "Audit log", icon: FileClockIcon, roles: ["OWNER", "ADMIN"] },
        ],
      },
    ],
  },
  {
    title: "System",
    groups: [
      {
        items: [
          { href: "/settings", label: "Settings", icon: SettingsIcon, roles: ["OWNER", "ADMIN"] },
          { href: "/settings/signature", label: "Signature", icon: PenLineIcon, roles: ["OWNER"] },
          { href: "/settings/profile", label: "Profile", icon: UserIcon, roles: ["OWNER", "ADMIN", "TRAINER"] },
        ],
      },
    ],
  },
];

/** Every item in a section, whether declared flat or in groups. */
export function sectionItems(section: NavSection): NavItem[] {
  return [...(section.items ?? []), ...(section.groups ?? []).flatMap((g) => g.items)];
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const STORAGE_KEY = "ksa:sidebar:groups";

export function SidebarNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  // Explicit user toggles only; a section holding the active route is open by default.
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOpenGroups(JSON.parse(raw) as Record<string, boolean>);
    } catch {}
  }, []);

  const toggleGroup = (key: string, currentlyOpen: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !currentlyOpen };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const renderItem = (item: NavItem) => {
    const active = isActivePath(pathname, item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          className={cn(
            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
            active ? "bg-orange/18 text-white" : "text-white/65 hover:bg-white/8 hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-orange transition-opacity duration-150",
              active ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon className="size-4 shrink-0" />
          {collapsed ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            <span className="truncate">{item.label}</span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav
      data-app="sidebar"
      aria-label="Main"
      className={cn("flex h-full flex-col bg-navy text-sidebar-foreground", className)}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/10 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
          aria-label="Kigali Safety Academy — go to dashboard"
        >
          <Logo showWordmark={!collapsed} size={32} wordmarkClassName="text-white" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 ksa-scroll-x">
        {NAV_SECTIONS.map((section) => {
          const items = sectionItems(section).filter(
            (item) => !item.roles || item.roles.includes(role),
          );
          if (items.length === 0) return null;

          // Flat sections (Main) and the collapsed rail list every item directly.
          const accordion = !collapsed && !section.items;
          const hasActive = items.some((item) => isActivePath(pathname, item.href));
          const open = openGroups[section.title] ?? hasActive;
          const panelId = `nav-${section.title.toLowerCase()}`;

          return (
            <div key={section.title} className="mb-3 last:mb-0">
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
              ) : accordion ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.title, open)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between px-4 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-white/40 uppercase hover:text-white/70 focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                >
                  {section.title}
                  <ChevronDownIcon
                    className={cn("size-3.5 transition-transform duration-150", !open && "-rotate-90")}
                  />
                </button>
              ) : (
                <p className="px-4 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-white/40 uppercase">
                  {section.title}
                </p>
              )}
              {(!accordion || open) && (
                <ul id={panelId} className="space-y-0.5 px-2">
                  {items.map(renderItem)}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <p className="shrink-0 px-4 pb-2 text-center text-[11px] text-white/35">
          Built by Gahire Abdilillah
        </p>
      )}
      <div
        className={cn(
          "shrink-0 border-t border-white/10 p-2",
          collapsed && "flex justify-center",
        )}
      >
        <UserMenu collapsed={collapsed} />
      </div>
    </nav>
  );
}

