import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { PasteListItem, PasteFilterParams } from "@/lib/admin";

interface PasteTableProps {
  pastes: PasteListItem[];
  total: number;
  page: number;
  totalPages: number;
  filters: PasteFilterParams;
  onFilterChange: (filters: PasteFilterParams) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onDeleteSingle: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, Math.min(i, units.length - 1));
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[Math.min(i, units.length - 1)]}`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface Column {
  key: string;
  label: string;
  sortable: boolean;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "id", label: "ID", sortable: true, className: "w-[120px]" },
  { key: "language", label: "Language", sortable: true },
  { key: "created_at", label: "Created", sortable: true },
  { key: "size", label: "Size", sortable: true, className: "text-right" },
  { key: "type", label: "Type", sortable: true },
  { key: "burn_after_read", label: "Burn", sortable: true },
  { key: "expires_at", label: "Expiration", sortable: true },
];

export function PasteTable({
  pastes,
  total,
  page,
  totalPages,
  filters,
  onFilterChange,
  selectedIds,
  onSelectionChange,
  onDeleteSingle,
}: PasteTableProps) {
  const handleSort = useCallback(
    (col: string) => {
      const isSameCol = filters.sort === col;
      const newOrder = isSameCol && filters.order === "DESC" ? "ASC" : "DESC";
      onFilterChange({ ...filters, sort: col, order: newOrder as "ASC" | "DESC" });
    },
    [filters, onFilterChange]
  );

  const toggleAll = useCallback(() => {
    if (selectedIds.size === pastes.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(pastes.map((p) => p.id)));
    }
  }, [pastes, selectedIds, onSelectionChange]);

  const toggleOne = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const sortIcon = (col: string) => {
    if (filters.sort !== col)
      return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return filters.order === "ASC" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  };

  if (pastes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No pastes found matching the current filters
      </div>
    );
  }

  const isExpired = (item: PasteListItem) =>
    item.expires_at && new Date(item.expires_at) < new Date();

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-3 py-2 text-left w-[40px]">
                <input
                  type="checkbox"
                  checked={
                    pastes.length > 0 && selectedIds.size === pastes.length
                  }
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${col.className || ""} ${col.sortable ? "cursor-pointer select-none hover:text-card-foreground" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center">
                    {col.label}
                    {col.sortable && sortIcon(col.key)}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 w-[60px]" />
            </tr>
          </thead>
          <tbody>
            {pastes.map((paste) => (
              <tr
                key={paste.id}
                className="border-b border-border/30 hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(paste.id)}
                    onChange={() => toggleOne(paste.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-primary">
                  {paste.id}
                </td>
                <td className="px-3 py-2 text-card-foreground">
                  {paste.language}
                </td>
                <td
                  className="px-3 py-2 text-muted-foreground"
                  title={new Date(paste.created_at).toLocaleString()}
                >
                  {timeAgo(paste.created_at)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {formatBytes(paste.size)}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className="text-xs border-border/50 uppercase"
                  >
                    {paste.type}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {paste.burn_after_read && (
                    <Badge className="text-xs bg-amber-500/20 text-amber-400 border-0 uppercase">
                      burn
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {paste.has_expiration ? (
                    isExpired(paste) ? (
                      <Badge className="text-xs bg-destructive/20 text-destructive border-0 uppercase">
                        expired
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-green-500/20 text-green-400 border-0 uppercase">
                        active
                      </Badge>
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs uppercase">none</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSingle(paste.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-2">
        <p className="text-xs text-muted-foreground">
          Showing {(page - 1) * (filters.limit || 50) + 1}–
          {Math.min(page * (filters.limit || 50), total)} of {total}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() =>
              onFilterChange({ ...filters, page: page - 1 })
            }
            className="h-8 w-8 p-0 border-border/50 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() =>
              onFilterChange({ ...filters, page: page + 1 })
            }
            className="h-8 w-8 p-0 border-border/50 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
