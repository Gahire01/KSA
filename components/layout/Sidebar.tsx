"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AwardIcon,
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileClockIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
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
          { href: "/trainees", label: "All", icon: UsersIcon },
          { href: "/trainees/new", label: "Add", icon: UsersIcon },
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
          { href: "/courses", label: "All", icon: BookOpenIcon },
          { href: "/courses/new", label: "Add", icon: BookOpenIcon },
        ],
      },
    ],
  },
  {
    title: "Exams",
    groups: [
      {
        items: [
          { href: "/exams", label: "All", icon: ClipboardCheckIcon },
          { href: "/exams/new", label: "Send links", icon: ClipboardCheckIcon },
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
          { href: "/certificates", label: "All", icon: AwardIcon },
          { href: "/certificates/issue", label: "Issue", icon: AwardIcon },
          { href: "/verify", label: "Verify", icon: AwardIcon },
        ],
      },
    ],
  },
  {
    title: "Payments",
    groups: [
      {
        items: [
          { href: "/payments", label: "All", icon: CreditCardIcon, roles: ["OWNER", "ADMIN"] },
          { href: "/payments/new", label: "Record", icon: CreditCardIcon, roles: ["OWNER", "ADMIN"] },
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
          { href: "/settings/profile", label: "Profile", icon: UserIcon, roles: ["OWNER", "ADMIN", "TRAINER"] },
        ],
      },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("ksa:sidebar:groups") : null;
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("ksa:sidebar:groups", JSON.stringify(openGroups));
      }
    } catch {}
  }, [openGroups]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
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
          <Logo
            showWordmark={!collapsed}
            size={32}
            wordmarkClassName="text-white"
          />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 ksa-scroll-x">
        {NAV_SECTIONS.map((section) => {
          const items = (section.items ?? []).filter(
            (item) => !item.roles || item.roles.includes(role),
          );
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-4 last:mb-0">
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
              ) : (
                <p className="px-4 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-white/40 uppercase">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5 px-2">
                {items.map((item) => {
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
                          active
                            ? "bg-orange/18 text-white"
                            : "text-white/65 hover:bg-white/8 hover:text-white",
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
                })}
              </ul>
            </div>
          );
        })}
      </div>

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
