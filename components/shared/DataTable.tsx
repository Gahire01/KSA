"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, Settings2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils/cn";

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  emptyState?: React.ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  enableSelection?: boolean;
  getRowId?: (row: TData) => string;
  bulkActions?: (selectedIds: string[], table: TableApiLike) => React.ReactNode;
  stickyHeader?: boolean;
  className?: string;
  /** Hide the built-in footer when the page renders its own pagination. */
  hideFooter?: boolean;
  initialSorting?: SortingState;
  globalFilter?: string;
  toolbar?: React.ReactNode;
  /** Announced to screen readers while loading. */
  loadingLabel?: string;
}

/* Minimal structural type so `bulkActions` does not need the full table API. */
export interface TableApiLike {
  getSelectedRowModel: () => { rows: { id: string }[] };
  resetRowSelection: () => void;
}

function SkeletonRows({ colCount, rows }: { colCount: number; rows: number }) {
  return Array.from({ length: rows }).map((_, r) => (
    <TableRow key={r}>
      {Array.from({ length: colCount }).map((__, c) => (
        <TableCell key={c}>
          <Skeleton className={cn("h-4 w-full", c === 0 ? "max-w-40" : "max-w-24")} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  onRowClick,
  emptyState,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50],
  enableSelection = false,
  getRowId,
  bulkActions,
  stickyHeader = true,
  className,
  hideFooter = false,
  initialSorting = [],
  globalFilter = "",
  toolbar,
  loadingLabel = "Loading data",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize });

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageSize }));
  }, [pageSize]);

  /* Reset to the first page whenever the result set changes. */
  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [data, globalFilter]);

  const selectionColumn: ColumnDef<TData, unknown> = React.useMemo(
    () => ({
      id: "select",
      size: 36,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select row ${row.index + 1}`}
        />
      ),
    }),
    [],
  );

  const allColumns = React.useMemo(
    () => (enableSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableSelection, selectionColumn],
  );

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    state: { sorting, rowSelection, columnFilters, columnVisibility, pagination, globalFilter },
    getRowId,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onGlobalFilterChange: () => undefined,
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = String(filterValue ?? "").toLowerCase();
      if (!needle) return true;
      return JSON.stringify(row.original).toLowerCase().includes(needle);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: enableSelection,
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;
  const selectedIds = Object.keys(rowSelection);
  const selectableColumns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide() && c.id !== "select" && c.id !== "actions");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {toolbar ? <div className="no-print">{toolbar}</div> : null}

      <div className="relative overflow-hidden rounded-xl border border-line bg-card shadow-sm">
        {isLoading ? (
          <span className="sr-only" role="status" aria-live="polite">
            {loadingLabel}
          </span>
        ) : null}

        <Table>
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-ink-2 uppercase transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-orange"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" ? (
                            <ArrowUpIcon className="size-3" />
                          ) : sortDir === "desc" ? (
                            <ArrowDownIcon className="size-3" />
                          ) : (
                            <ChevronsUpDownIcon className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <SkeletonRows colCount={allColumns.length} rows={Math.min(pageSize, 8)} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="p-0">
                  {emptyState ?? (
                    <EmptyState
                      compact
                      title="Nothing here yet"
                      description="Try adjusting your filters, or add the first record."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {bulkActions && selectedIds.length > 0 ? (
        <div className="no-print sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-medium text-ink">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions(
              selectedIds,
              table as unknown as TableApiLike,
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => table.resetRowSelection()}
          >
            Clear
          </Button>
        </div>
      ) : null}

      {!hideFooter && !isLoading ? (
        <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-ink-2" role="status" aria-live="polite">
              {totalRows === 0
                ? "No rows"
                : `Showing ${pagination.pageIndex * pagination.pageSize + 1}–${Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    totalRows,
                  )} of ${totalRows}`}
            </p>
            <label className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="sr-only sm:not-sr-only">Rows per page</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-7 rounded-md border border-line bg-card px-1.5 text-xs text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-3">
            {selectableColumns.length > 2 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings2Icon className="size-3.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {selectableColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(v) => column.toggleVisibility(!!v)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {column.id.replace(/([A-Z])/g, " $1")}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <span className="px-2 text-xs text-ink-2 tabular">
                Page {pagination.pageIndex + 1} of {Math.max(1, pageCount)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
