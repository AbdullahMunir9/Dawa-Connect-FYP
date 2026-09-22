import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "../../lib/format";
import { EmptyState, Skeleton, Select } from "./primitives";

function getValue(row, column) {
  if (typeof column.accessor === "function") return column.accessor(row);
  if (column.accessor) return row[column.accessor];
  return row[column.id];
}

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const da = a instanceof Date ? a : null; const db = b instanceof Date ? b : null;
  if (da && db) return da - db;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * columns: [{ id, header, accessor?, cell?, sortable?, align?, width?, className?, hideBelow? }]
 * rows: array of objects. rowKey: fn(row) or key name.
 */
export function DataTable({
  columns, rows, rowKey = "_id", loading = false, error = "", emptyTitle = "Nothing here yet", emptyDescription, emptyIcon = Inbox, emptyAction,
  pageSize: initialPageSize = 15, defaultSort = null, onRowClick, rowClassName, selectedKey, dense = false, stickyHeader = true, footerNote, className,
}) {
  const [sort, setSort] = useState(defaultSort); // { id, dir: 'asc' | 'desc' }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column) return rows;
    const list = [...rows].sort((a, b) => compare(getValue(a, column.sortValue ? { accessor: column.sortValue } : column), getValue(b, column.sortValue ? { accessor: column.sortValue } : column)));
    return sort.dir === "desc" ? list.reverse() : list;
  }, [rows, sort, columns]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Reset to the first page whenever the row set changes (derived-state pattern, no effect needed).
  const [prevTotal, setPrevTotal] = useState(total);
  if (total !== prevTotal) { setPrevTotal(total); setPage(1); }
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  function toggleSort(column) {
    if (!column.sortable) return;
    setSort((current) => {
      if (current?.id !== column.id) return { id: column.id, dir: "asc" };
      if (current.dir === "asc") return { id: column.id, dir: "desc" };
      return null;
    });
  }

  const keyOf = (row, index) => (typeof rowKey === "function" ? rowKey(row) : row[rowKey]) ?? index;
  const cellPad = dense ? "px-3 py-2" : "px-4 py-3";

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={cn("text-[11px] font-semibold uppercase tracking-wide text-subtle", stickyHeader && "sticky top-0 z-10 bg-surface")}>
            <tr className="border-b border-line">
              {columns.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <th key={column.id} scope="col" style={{ width: column.width }}
                    className={cn(cellPad, "whitespace-nowrap font-semibold", column.align === "right" && "text-right", column.align === "center" && "text-center", column.hideBelow === "md" && "hidden md:table-cell", column.hideBelow === "lg" && "hidden lg:table-cell", column.hideBelow === "xl" && "hidden xl:table-cell")}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {column.sortable ? (
                      <button type="button" onClick={() => toggleSort(column)} className={cn("group inline-flex items-center gap-1 rounded hover:text-ink", active && "text-ink")}>
                        {column.header}
                        {active ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />}
                      </button>
                    ) : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && rows.length === 0 && Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
              <tr key={`sk-${i}`}>{columns.map((column) => <td key={column.id} className={cn(cellPad, column.hideBelow === "md" && "hidden md:table-cell", column.hideBelow === "lg" && "hidden lg:table-cell", column.hideBelow === "xl" && "hidden xl:table-cell")}><Skeleton className={cn("h-4", i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3")} /></td>)}</tr>
            ))}
            {!loading && error && (
              <tr><td colSpan={columns.length}><EmptyState title="Couldn’t load this data" description={error} compact action={emptyAction} /></td></tr>
            )}
            {!loading && !error && total === 0 && (
              <tr><td colSpan={columns.length}><EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} /></td></tr>
            )}
            {visible.map((row, index) => {
              const key = keyOf(row, start + index);
              const selected = selectedKey != null && selectedKey === key;
              return (
                <tr key={key} onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-surface-2", selected && "bg-brand-50/60 dark:bg-brand-950/30", typeof rowClassName === "function" ? rowClassName(row) : rowClassName)}>
                  {columns.map((column) => (
                    <td key={column.id} className={cn(cellPad, "align-middle", column.align === "right" && "text-right", column.align === "center" && "text-center", column.hideBelow === "md" && "hidden md:table-cell", column.hideBelow === "lg" && "hidden lg:table-cell", column.hideBelow === "xl" && "hidden xl:table-cell", column.className)}>
                      {column.cell ? column.cell(row) : (getValue(row, column) ?? <span className="text-subtle">—</span>)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(total > 0 || footerNote) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
          <div className="flex items-center gap-3">
            <span className="tabular">{total === 0 ? "0 results" : `${start + 1}–${Math.min(total, start + pageSize)} of ${total.toLocaleString()}`}</span>
            {footerNote && <span className="hidden text-subtle sm:inline">· {footerNote}</span>}
          </div>
          {total > Math.min(...[10, initialPageSize]) && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                <span className="hidden sm:inline">Rows</span>
                <Select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-7 w-18 py-0 text-xs">
                  {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-md p-1.5 hover:bg-surface-3 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                <span className="tabular px-1">{currentPage} / {pageCount}</span>
                <button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="rounded-md p-1.5 hover:bg-surface-3 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
