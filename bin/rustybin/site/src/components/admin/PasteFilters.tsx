import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Search } from "lucide-react";
import type { PasteFilterParams } from "@/lib/admin";

interface PasteFiltersProps {
  filters: PasteFilterParams;
  onFilterChange: (filters: PasteFilterParams) => void;
  languages: string[];
}

export function PasteFilters({
  filters,
  onFilterChange,
  languages,
}: PasteFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || "");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || "")) {
        onFilterChange({ ...filters, search: searchInput || undefined, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = useCallback(
    (key: keyof PasteFilterParams, value: unknown) => {
      onFilterChange({ ...filters, [key]: value, page: 1 });
    },
    [filters, onFilterChange]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    onFilterChange({
      page: 1,
      limit: filters.limit,
      sort: "created_at",
      order: "DESC",
    });
  }, [filters.limit, onFilterChange]);

  const hasFilters =
    filters.language ||
    filters.type ||
    filters.burn !== undefined ||
    filters.expiration !== undefined ||
    filters.search ||
    filters.start_date ||
    filters.end_date;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Search by ID */}
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            Search by ID
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Paste ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-9 bg-muted border-border text-card-foreground text-sm"
            />
          </div>
        </div>

        {/* Language filter */}
        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            Language
          </Label>
          <select
            value={filters.language || ""}
            onChange={(e) =>
              updateFilter("language", e.target.value || undefined)
            }
            className="w-full h-9 rounded border border-border bg-muted px-2 text-sm text-card-foreground"
          >
            <option value="">All</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <div className="min-w-[120px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            Type
          </Label>
          <select
            value={filters.type || ""}
            onChange={(e) =>
              updateFilter("type", e.target.value || undefined)
            }
            className="w-full h-9 rounded border border-border bg-muted px-2 text-sm text-card-foreground"
          >
            <option value="">All</option>
            <option value="paste">Paste</option>
            <option value="workspace">Workspace</option>
          </select>
        </div>

        {/* Burn after read filter */}
        <div className="min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            Burn After Read
          </Label>
          <select
            value={filters.burn === undefined ? "" : String(filters.burn)}
            onChange={(e) => {
              const v = e.target.value;
              updateFilter(
                "burn",
                v === "" ? undefined : v === "true"
              );
            }}
            className="w-full h-9 rounded border border-border bg-muted px-2 text-sm text-card-foreground"
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {/* Expiration filter */}
        <div className="min-w-[130px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            Has Expiration
          </Label>
          <select
            value={
              filters.expiration === undefined
                ? ""
                : String(filters.expiration)
            }
            onChange={(e) => {
              const v = e.target.value;
              updateFilter(
                "expiration",
                v === "" ? undefined : v === "true"
              );
            }}
            className="w-full h-9 rounded border border-border bg-muted px-2 text-sm text-card-foreground"
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {/* Date range */}
        <div className="min-w-[130px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            From
          </Label>
          <input
            type="date"
            value={
              filters.start_date
                ? new Date(filters.start_date * 1000)
                    .toISOString()
                    .split("T")[0]
                : ""
            }
            onChange={(e) => {
              const ts = e.target.value
                ? Math.floor(new Date(e.target.value).getTime() / 1000)
                : undefined;
              updateFilter("start_date", ts);
            }}
            className="w-full h-9 rounded border border-border bg-muted px-2 text-sm text-card-foreground"
          />
        </div>
        <div className="min-w-[130px]">
          <Label className="text-xs text-muted-foreground mb-1 block">
            To
          </Label>
          <input
            type="date"
            value={
              filters.end_date
                ? new Date(filters.end_date * 1000)
                    .toISOString()
                    .split("T")[0]
                : ""
            }
            onChange={(e) => {
              const ts = e.target.value
                ? Math.floor(new Date(e.target.value).getTime() / 1000)
                : undefined;
              updateFilter("end_date", ts);
            }}
            className="w-full h-9 rounded border border-border bg-muted px-2 text-sm text-card-foreground"
          />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-card-foreground h-9"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
