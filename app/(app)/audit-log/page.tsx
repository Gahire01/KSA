"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DownloadIcon,
  FileClockIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  WalletIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { SearchInput } from "@/components/shared/SearchInput";
import { FilterChips, type Chip } from "@/components/shared/FilterChips";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { CopyButton } from "@/components/shared/CopyButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mockApi } from "@/lib/mock";
import { formatDateTime, formatNumber, formatRelative, titleCase } from "@/lib/utils/format";
import type { AuditAction, AuditEntry } from "@/lib/types";

const FETCH_SIZE = 500;

const ACTION_GROUPS: { label: string; values: AuditAction[]; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    label: "Trainees",
    icon: UserPlusIcon,
    values: ["trainee.create", "trainee.update", "trainee.delete", "trainee.import"],
  },
  {
    label: "Payments",
    icon: WalletIcon,
    values: ["payment.record", "payment.refund", "payment.update"],
  },
  {
    label: "Certificates",
    icon: ShieldCheckIcon,
    values: ["certificate.issue", "certificate.revoke"],
  },
  {
    label: "Exams",
    icon: FileClockIcon,
    values: ["exam.send", "exam.create", "exam.update", "question.create", "question.update", "question.delete"],
  },
  {
    label: "System",
    icon: FileClockIcon,
    values: [
      "course.create",
      "course.update",
      "trainer.update",
      "settings.update",
      "report.generate",
      "user.login",
      "user.logout",
    ],
  },
];

const ALL_ACTIONS = ACTION_GROUPS.flatMap((g) => g.values);

const ENTITY_TYPES = ["trainee", "payment", "certificate", "exam", "course", "user", "report"];

const ACTION_TONE: Record<string, string> = {
  create: "bg-green-bg text-green",
  update: "bg-navy/10 text-navy",
  delete: "bg-red-bg text-red",
  revoke: "bg-red-bg text-red",
  refund: "bg-amber-bg text-amber",
  import: "bg-amber-bg text-amber",
  login: "bg-muted text-ink-2",
  logout: "bg-muted text-ink-2",
  send: "bg-orange/10 text-orange",
  issue: "bg-green-bg text-green",
  record: "bg-green-bg text-green",
  generate: "bg-navy/10 text-navy",
};

function actionTone(action: AuditAction): string {
  const verb = action.split(".")[1] ?? "";
  return ACTION_TONE[verb] ?? "bg-muted text-ink-2";
}

interface Filters {
  search: string;
  actions: AuditAction[];
  entityTypes: string[];
  range: DateRange;
}

const EMPTY: Filters = { search: "", actions: [], entityTypes: [], range: {} };

export default function AuditLogPage() {
  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [searchDraft, setSearchDraft] = React.useState("");
  const debouncedSearch = useDebounce(searchDraft, 300);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action) {
      setFilters((f) => ({
        ...f,
        actions: action
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is AuditAction => (ALL_ACTIONS as string[]).includes(s)),
      }));
    }
    const entity = params.get("entityType");
    if (entity) setFilters((f) => ({ ...f, entityTypes: [entity] }));
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch }));
  }, [debouncedSearch, hydrated]);

  const listFilters = React.useMemo(
    () => ({
      search: filters.search || undefined,
      actions: filters.actions.length ? filters.actions : undefined,
      entityTypes: filters.entityTypes.length ? filters.entityTypes : undefined,
      from: filters.range.from,
      to: filters.range.to,
      sort: { id: "at", desc: true },
      page: 1,
      pageSize: FETCH_SIZE,
    }),
    [filters],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", listFilters],
    queryFn: () => mockApi.audit.list(listFilters),
    staleTime: 15_000,
  });

  const rows = data?.rows ?? [];

  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        id: "at",
        header: "When",
        accessorFn: (a) => a.at,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm whitespace-nowrap text-ink">
              {formatDateTime(row.original.at)}
            </p>
            <p className="text-xs whitespace-nowrap text-ink-3">
              {formatRelative(row.original.at)}
            </p>
          </div>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (a) => a.actorName,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {row.original.actorName}
            </p>
            <p className="text-xs text-ink-3">{titleCase(row.original.actorRole)}</p>
          </div>
        ),
      },
      {
        id: "action",
        header: "Action",
        accessorFn: (a) => a.action,
        cell: ({ row }) => (
          <span
            className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs font-medium ${actionTone(row.original.action)}`}
          >
            {row.original.action}
          </span>
        ),
      },
      {
        id: "entity",
        header: "Record",
        accessorFn: (a) => a.entityLabel,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{row.original.entityLabel}</p>
            <p className="truncate font-mono text-xs text-ink-3">
              {row.original.entityType} · {row.original.entityId}
            </p>
          </div>
        ),
      },
      {
        id: "ip",
        header: "IP",
        accessorFn: (a) => a.ip,
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap text-ink-2">
            {row.original.ip}
          </span>
        ),
      },
      {
        id: "diff",
        header: "Change",
        enableSorting: false,
        cell: ({ row }) => {
          const { before, after } = row.original;
          if (!before && !after) return <span className="text-xs text-ink-3">—</span>;
          return (
            <details className="group relative">
              <summary className="cursor-pointer list-none text-xs font-medium text-orange hover:underline">
                View
              </summary>
              <div className="mt-2 w-80 max-w-[80vw] rounded-lg border border-line bg-card p-3 text-xs shadow-lg">
                <p className="mb-1 font-semibold text-ink">Before</p>
                <pre className="max-h-32 overflow-auto rounded bg-paper p-2 font-mono whitespace-pre-wrap text-ink-2">
                  {before ? JSON.stringify(before, null, 2) : "—"}
                </pre>
                <p className="mt-2 mb-1 font-semibold text-ink">After</p>
                <pre className="max-h-32 overflow-auto rounded bg-paper p-2 font-mono whitespace-pre-wrap text-ink-2">
                  {after ? JSON.stringify(after, null, 2) : "—"}
                </pre>
              </div>
            </details>
          );
        },
      },
    ],
    [],
  );

  const chips: Chip[] = React.useMemo(() => {
    const out: Chip[] = [];
    if (filters.actions.length) {
      out.push({
        id: "action",
        label: "Action",
        value:
          filters.actions.length === 1
            ? filters.actions[0]!
            : `${filters.actions.length} actions`,
        onRemove: () => setFilters((f) => ({ ...f, actions: [] })),
      });
    }
    if (filters.entityTypes.length) {
      out.push({
        id: "entity",
        label: "Record type",
        value: filters.entityTypes.join(", "),
        onRemove: () => setFilters((f) => ({ ...f, entityTypes: [] })),
      });
    }
    if (filters.range.from || filters.range.to) {
      out.push({
        id: "date",
        label: "Between",
        value: `${filters.range.from ?? "…"} → ${filters.range.to ?? "…"}`,
        onRemove: () => setFilters((f) => ({ ...f, range: {} })),
      });
    }
    return out;
  }, [filters]);

  const clearAll = () => {
    setSearchDraft("");
    setFilters(EMPTY);
  };

  return (
    <div className="space-y-5">
      <DemoBanner>
        Audit entries below are demo data generated in the browser. Nothing you
        do here is written to the database.
      </DemoBanner>

      <PageHeader
        title="Audit log"
        subtitle={
          isLoading
            ? "Loading entries…"
            : `${formatNumber(data?.total ?? 0)} entries · append-only record of every change`
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={searchDraft}
              onValueChange={setSearchDraft}
              placeholder="Search actor, action or record…"
              className="lg:max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              {ACTION_GROUPS.map((group) => (
                <MultiSelectFilter
                  key={group.label}
                  label={group.label}
                  width="w-64"
                  options={group.values.map((a) => ({ value: a, label: a }))}
                  selected={filters.actions.filter((a) => group.values.includes(a))}
                  onChange={(next) => {
                    const picked = next as AuditAction[];
                    setFilters((f) => ({
                      ...f,
                      actions: [
                        ...f.actions.filter((a) => !group.values.includes(a)),
                        ...picked,
                      ],
                    }));
                  }}
                />
              ))}
              <MultiSelectFilter
                label="Record type"
                width="w-52"
                options={ENTITY_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
                selected={filters.entityTypes}
                onChange={(entityTypes) =>
                  setFilters((f) => ({ ...f, entityTypes: entityTypes as typeof f.entityTypes }))
                }
              />
              <DateRangePicker
                value={filters.range}
                onChange={(range) => setFilters((f) => ({ ...f, range }))}
                label="Logged between"
              />
            </div>
          </div>
          <FilterChips chips={chips} onClearAll={clearAll} clearLabel="Reset all filters" />
        </CardContent>
      </Card>

      {isError ? (
        <EmptyState
          title="Could not load the audit log"
          description="The log did not respond. Try again."
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(a) => a.id}
          isLoading={isLoading}
          globalFilter={filters.search}
          pageSize={25}
          emptyState={
            <EmptyState
              title="No audit entries match your filters"
              description="Clear the filters to see the full history."
              action={
                <Button size="sm" variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          }
          bulkActions={(ids) => (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const chosen = rows.filter((a) => ids.includes(a.id));
                  const header = ["at", "actor", "role", "action", "entity_type", "entity", "ip"];
                  const lines = chosen.map((a) =>
                    [
                      a.at,
                      a.actorName,
                      a.actorRole,
                      a.action,
                      a.entityType,
                      a.entityLabel,
                      a.ip,
                    ]
                      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
                      .join(","),
                  );
                  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
                    type: "text/csv;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const el = document.createElement("a");
                  el.href = url;
                  el.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
                  el.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <DownloadIcon className="size-3.5" />
                Export CSV
              </Button>
              <CopyButton
                value={rows
                  .filter((a) => ids.includes(a.id))
                  .map(
                    (a) =>
                      `${a.at} · ${a.actorName} · ${a.action} · ${a.entityLabel}`,
                  )
                  .join("\n")}
                label="trail"
                toastMessage="Selected entries copied"
              />
            </>
          )}
        />
      )}
    </div>
  );
}
