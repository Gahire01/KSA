"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AwardIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { NAV_SECTIONS } from "@/components/layout/Sidebar";
import { useUiStore } from "@/lib/stores/ui-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { mockApi } from "@/lib/mock";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  run?: () => void;
  badge?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const recentPages = useUiStore((s) => s.recentPages);
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");

  const [query, setQuery] = React.useState("");
  const [trainees, setTrainees] = React.useState<{ id: string; name: string; traineeNo: string }[]>([]);

  /* Local search of trainee names for the "Jump to" group. */
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void mockApi.trainees
      .list({ page: 1, pageSize: 50, search: query })
      .then((res) => {
        if (cancelled) return;
        setTrainees(res.rows.map((t) => ({ id: t.id, name: t.name, traineeNo: t.traineeNo })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router, setOpen],
  );

  const navCommands: Cmd[] = React.useMemo(
    () =>
      NAV_SECTIONS.flatMap((section) =>
        (section.items ?? [])
          .filter((item) => !item.roles || item.roles.includes(role))
          .map((item) => ({
            id: `nav:${item.href}`,
            label: item.label,
            hint: section.title,
            href: item.href,
            group: "Navigate",
            icon: item.icon,
            keywords: `${item.label} ${section.title}`,
          })),
      ),
    [role],
  );

  const actionCommands: Cmd[] = React.useMemo(
    () => [
      {
        id: "act:new-trainee",
        label: "Add new trainee",
        group: "Actions",
        icon: UserPlusIcon,
        href: "/trainees/new",
        keywords: "add create trainee enrol",
      },
      {
        id: "act:import",
        label: "Import trainees (CSV)",
        group: "Actions",
        icon: UsersIcon,
        href: "/trainees/import",
        keywords: "bulk csv upload import",
      },
      {
        id: "act:new-exam",
        label: "Schedule exam",
        group: "Actions",
        icon: ClipboardCheckIcon,
        href: "/exams/new",
        keywords: "exam schedule invite",
      },
      {
        id: "act:new-course",
        label: "Create course",
        group: "Actions",
        icon: BookOpenIcon,
        href: "/courses/new",
        keywords: "course create add",
      },
      {
        id: "act:record-payment",
        label: "Record a payment",
        group: "Actions",
        icon: CreditCardIcon,
        href: "/payments/new",
        keywords: "payment momo record",
      },
      {
        id: "act:issue-cert",
        label: "Issue certificate",
        group: "Actions",
        icon: AwardIcon,
        href: "/certificates",
        keywords: "certificate issue",
      },
      {
        id: "act:copy-verify",
        label: "Verify a certificate",
        group: "Actions",
        icon: ShieldCheckIcon,
        href: "/verify",
        keywords: "verify certificate public",
      },
      {
        id: "act:theme",
        label: "Toggle theme",
        group: "Actions",
        icon: SettingsIcon,
        keywords: "theme dark light appearance",
        run: () => {
          const current = document.documentElement.classList.contains("dark");
          const next = current ? "light" : "dark";
          document.documentElement.classList.toggle("dark", next === "dark");
          localStorage.setItem("ksa-theme", next);
          toast(`Switched to ${next} mode`);
        },
      },
    ],
    [],
  );

  const traineeCommands: Cmd[] = React.useMemo(
    () =>
      trainees.slice(0, 6).map((t) => ({
        id: `trainee:${t.id}`,
        label: t.name,
        hint: t.traineeNo,
        href: `/trainees/${t.id}`,
        group: "Trainees",
        icon: UsersIcon,
        keywords: `${t.name} ${t.traineeNo}`,
      })),
    [trainees],
  );

  const recentCommands: Cmd[] = React.useMemo(
    () =>
      recentPages.map((p) => ({
        id: `recent:${p.path}`,
        label: p.label,
        hint: "Recent",
        href: p.path,
        group: "Recent",
        icon: SearchIcon,
        keywords: `recent ${p.label}`,
      })),
    [recentPages],
  );

  const sections = React.useMemo(() => {
    const map = new Map<string, Cmd[]>();
    for (const cmd of [...recentCommands, ...navCommands, ...actionCommands, ...traineeCommands]) {
      const list = map.get(cmd.group) ?? [];
      list.push(cmd);
      map.set(cmd.group, list);
    }
    const order = ["Recent", "Navigate", "Actions", "Trainees"];
    return order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [recentCommands, navCommands, actionCommands, traineeCommands]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search trainees, jump to a page, or run an action."
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search trainees, pages, actions…"
      />
      <CommandList>
        <CommandEmpty>No matches. Try a different term.</CommandEmpty>
        {sections.map(({ group, items }, i) => (
          <React.Fragment key={group}>
            {i > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={group}>
              {items.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords ?? ""} ${cmd.hint ?? ""}`}
                    onSelect={() => {
                      if (cmd.run) {
                        cmd.run();
                        setOpen(false);
                      } else if (cmd.href) {
                        go(cmd.href);
                      }
                    }}
                  >
                    <Icon className="size-4 text-ink-2" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.hint ? (
                      <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                        {cmd.hint}
                      </Badge>
                    ) : null}
                    {cmd.group === "Navigate" ? <CommandShortcut>↵</CommandShortcut> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/* Small helper used elsewhere to trigger the palette. */
export function useCommandPalette() {
  return useUiStore((s) => s.setCommandPaletteOpen);
}
