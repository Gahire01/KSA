"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AwardIcon,
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileClockIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
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

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/trainees", label: "Trainees", icon: UsersIcon },
      { href: "/courses", label: "Courses", icon: BookOpenIcon },
      { href: "/exams", label: "Exams", icon: ClipboardCheckIcon },
      { href: "/certificates", label: "Certificates", icon: AwardIcon },
      { href: "/payments", label: "Payments", icon: CreditCardIcon, roles: ["OWNER", "ADMIN"] },
      { href: "/notifications", label: "Notifications", icon: BellIcon },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/trainers", label: "Trainers", icon: ShieldCheckIcon, roles: ["OWNER", "ADMIN"] },
      {
        href: "/access",
        label: "Access control",
        icon: KeyRoundIcon,
        roles: ["OWNER"],
      },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3Icon, roles: ["OWNER", "ADMIN"] },
      { href: "/audit-log", label: "Audit log", icon: FileClockIcon, roles: ["OWNER", "ADMIN"] },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/settings", label: "Settings", icon: SettingsIcon, roles: ["OWNER", "ADMIN"] },
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
            size={collapsed ? 32 : 34}
            wordmarkClassName="text-white"
          />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 ksa-scroll-x">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
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
