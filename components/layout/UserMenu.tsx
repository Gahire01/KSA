"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellIcon, LogOutIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@/lib/api/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils/cn";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  TRAINER: "Trainer",
};

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const logout = useLogout();
  const role = currentUser?.role ?? "ADMIN";
  const canSeeSettings = role === "OWNER" || role === "ADMIN";

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
            collapsed && "justify-center",
          )}
          aria-label={`Account menu for ${currentUser.name}`}
        >
          <AvatarInitials
            name={currentUser.name}
            size="sm"
            className="ring-1 ring-white/20"
          />
          {collapsed ? null : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {currentUser.name}
              </span>
              <span className="block truncate text-[11px] text-white/50">
                {ROLE_LABEL[role]}
              </span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-ink">{currentUser.name}</p>
          <p className="truncate text-xs text-ink-2">{currentUser.email}</p>
          <Badge variant="orange" className="mt-1.5">
            {ROLE_LABEL[role]}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => router.push("/settings/profile")}
          disabled={!canSeeSettings}
        >
          <UserIcon className="size-4" />
          Profile
        </DropdownMenuItem>
        {canSeeSettings ? (
          <DropdownMenuItem onSelect={() => router.push("/settings/notifications")}>
            <BellIcon className="size-4" />
            Notification settings
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-ink-2">Theme</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            /* Clear the server session first, then the client mirror. */
            logout.mutate(undefined, {
              onSettled: () => {
                clearSession();
                toast("Signed out", { description: "See you next session." });
                router.replace("/login");
                router.refresh();
              },
            });
          }}
        >
          <LogOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
