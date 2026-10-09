"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { ExportMenu } from "@/components/shared/ExportMenu";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/utils/format";

/**
 * /audit-log — the append-only record of privileged actions (owner only). Every row
 * is real; there is no way to edit or delete one from anywhere in the app.
 */

interface AuditRow {
  id: string;
  at: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
}

interface AuditPage {
  items: AuditRow[];
  total: number;
  actions: string[];
}

const ACTION_TONE: Record<string, string> = {
  create: "bg-green-bg text-green",
  update: "bg-navy/10 text-navy",
  delete: "bg-red-bg text-red",
  revoke: "bg-red-bg text-red",
  refund: "bg-amber-bg text-amber",
  import: "bg-amber-bg text-amber",
  login: "bg-muted text-ink-2",
  send: "bg-orange/10 text-orange",
  issue: "bg-green-bg text-green",
  record: "bg-green-bg text-green",
  submit: "bg-navy/10 text-navy",
  grant: "bg-amber-bg text-amber",
};

function actionTone(action: string): string {
  const verb = action.split(".").pop() ?? "";
  return ACTION_TONE[verb] ?? "bg-muted text-ink-2";
}

export default function AuditLogPage() {
  const [searchDraft, setSearchDraft] = React.useState("");
  const search = useDebounce(searchDraft, 300);
  const [actions, setActions] = React.useState<string[]>([]);
  const [range, setRange] = React.useState<DateRange>({});

  /* Dashboard deep link: /audit-log?action=certificate.revoke */
  React.useEffect(() => {
    const action = new URLSearchParams(window.location.search).get("action");
    if (action) setActions(action.split(",").map((a) => a.trim()).filter(Boolean));
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", { search, actions, range }],
    queryFn: () =>
      api.get<AuditPage>("/audit-log", {
        search: search || undefined,
        /* The API filters on one action; several are narrowed on this side. */
        action: actions.length === 1 ? actions[0] : undefined,
        from: range.from,
        to: range.to,
        pageSize: 200,
      }),
    staleTime: 15_000,
  });

  const rows = React.useMemo(
    () => (data?.items ?? []).filter((r) => actions.length === 0 || actions.includes(r.action)),
    [data, actions],
  );

  const columns = React.useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      {
        id: "at",
        header: "When",
        accessorFn: (a) => a.at,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm whitespace-nowrap text-ink">{formatDateTime(row.original.at)}</p>
            <p className="text-xs whitespace-nowrap text-ink-3">{formatRelative(row.original.at)}</p>
          </div>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (a) => a.actorEmail ?? "",
        cell: ({ row }) => (
          <span className="truncate text-sm font-medium text-ink">{row.original.actorEmail ?? "Trainee / system"}</span>
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
        accessorFn: (a) => a.entityType ?? "",
        cell: ({ row }) => (
          <p className="truncate font-mono text-xs text-ink-2">
            {row.original.entityType ?? "—"}
            {row.original.entityId ? ` · ${row.original.entityId}` : ""}
          </p>
        ),
      },
      {
        id: "ip",
        header: "IP",
        accessorFn: (a) => a.ip ?? "",
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap text-ink-2">{row.original.ip ?? "—"}</span>
        ),
      },
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.meta ? (
            <details className="relative">
              <summary className="cursor-pointer list-none text-xs font-medium text-orange hover:underline">View</summary>
              <pre className="mt-2 max-h-40 w-72 max-w-[80vw] overflow-auto rounded-lg border border-line bg-paper p-2 font-mono text-xs whitespace-pre-wrap text-ink-2">
                {JSON.stringify(row.original.meta, null, 2)}
              </pre>
            </details>
          ) : (
            <span className="text-xs text-ink-3">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        subtitle={
          isLoading
            ? "Loading entries…"
            : `${formatNumber(data?.total ?? 0)} entries · append-only record of every change`
        }
        actions={<ExportMenu type="audit-log" params={{ from: range.from, to: range.to }} />}
      />

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={searchDraft}
            onValueChange={setSearchDraft}
            placeholder="Search actor, action or record…"
            className="lg:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Action"
              searchable
              width="w-72"
              options={(data?.actions ?? []).map((a) => ({ value: a, label: a }))}
              selected={actions}
              onChange={setActions}
            />
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <EmptyState
          title="The audit log could not be loaded"
          description="Only the owner can read it."
          action={<button className="text-sm underline" onClick={() => void refetch()}>Try again</button>}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          getRowId={(a) => a.id}
          emptyState={<EmptyState title="No entries yet" description="Actions appear here as they happen." />}
        />
      )}
    </div>
  );
}
