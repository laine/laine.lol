import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Loader2 } from "lucide-react";
import {
  fetchStats,
  fetchPastes,
  deletePaste,
  bulkDeletePastes,
  logout,
  type StatsResponse,
  type PasteListResponse,
  type PasteFilterParams,
} from "@/lib/admin";
import { toast } from "sonner";
import { StatsCards } from "@/components/admin/StatsCards";
import { TimeSeriesChart } from "@/components/admin/TimeSeriesChart";
import { LanguageBreakdown } from "@/components/admin/LanguageBreakdown";
import { PasteFilters } from "@/components/admin/PasteFilters";
import { PasteTable } from "@/components/admin/PasteTable";
import { DeleteDialog } from "@/components/admin/DeleteDialog";

type TimeRange = "24h" | "7d" | "30d" | "1y" | "all" | "custom";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Paste table state
  const [filters, setFilters] = useState<PasteFilterParams>({
    page: 1,
    limit: 50,
    sort: "created_at",
    order: "DESC",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const startTs =
    timeRange === "custom" && customStart
      ? Math.floor(new Date(customStart).getTime() / 1000)
      : undefined;
  const endTs =
    timeRange === "custom" && customEnd
      ? Math.floor(new Date(customEnd + "T23:59:59").getTime() / 1000)
      : undefined;

  const customRangeReady =
    timeRange !== "custom" || (startTs !== undefined && endTs !== undefined);

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<StatsResponse>({
    queryKey: ["admin-stats", timeRange, startTs, endTs],
    queryFn: () => fetchStats(timeRange, startTs, endTs),
    retry: false,
    enabled: customRangeReady,
  });

  const {
    data: pastesData,
    isLoading: pastesLoading,
  } = useQuery<PasteListResponse>({
    queryKey: ["admin-pastes", filters],
    queryFn: () => fetchPastes(filters),
    retry: false,
  });

  // Extract language list from stats for filter dropdown
  const languages = useMemo(() => {
    if (!stats?.language_stats) return [];
    return Object.keys(stats.language_stats).sort();
  }, [stats]);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "single" | "bulk";
    id?: string;
    ids?: string[];
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteSingle = useCallback((id: string) => {
    setDeleteTarget({ type: "single", id });
  }, []);

  const handleBulkDelete = useCallback(() => {
    setDeleteTarget({ type: "bulk", ids: Array.from(selectedIds) });
  }, [selectedIds]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === "single" && deleteTarget.id) {
        await deletePaste(deleteTarget.id);
        toast.success(`Paste ${deleteTarget.id} deleted`);
      } else if (deleteTarget.type === "bulk" && deleteTarget.ids) {
        const result = await bulkDeletePastes(deleteTarget.ids);
        toast.success(`${result.deleted_count} paste(s) deleted`);
        if (result.not_found.length > 0) {
          toast.warning(
            `${result.not_found.length} paste(s) were already deleted`
          );
        }
      }
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-pastes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Delete failed"
      );
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, queryClient]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/admin/login");
  }, [navigate]);

  if (statsError?.message === "Unauthorized") {
    navigate("/admin/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#14151b]">
      {/* Header */}
      <header className="border-b border-border bg-card backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-primary">
            Dashboard
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-card-foreground rounded"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Time Range Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {TIME_RANGES.map((r) => (
            <Button
              key={r.value}
              variant={timeRange === r.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(r.value)}
              className={
                timeRange === r.value
                  ? "rounded"
                  : "text-muted-foreground hover:text-card-foreground rounded border-white/10"
              }
            >
              {r.label}
            </Button>
          ))}

          {timeRange === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-muted border border-border rounded px-2 py-1 text-sm text-card-foreground"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-muted border border-border rounded px-2 py-1 text-sm text-card-foreground"
              />
            </div>
          )}
        </div>

        {/* Loading State */}
        {statsLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {statsError && statsError.message !== "Unauthorized" && (
          <div className="text-center py-20 text-destructive">
            <p>Failed to load dashboard data</p>
            <p className="text-sm text-muted-foreground mt-1">
              {statsError.message}
            </p>
          </div>
        )}

        {/* Stats Content */}
        {stats && !statsLoading && (
          <>
            {/* Summary Cards */}
            <StatsCards
              totalPastes={stats.total_pastes}
              pendingExpiration={stats.pending_expiration}
              burnAfterReadCount={stats.burn_after_read_count}
              totalSize={stats.total_size}
            />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Paste Creation Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TimeSeriesChart data={stats.pastes_over_time} />
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Language Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LanguageBreakdown data={stats.language_stats} />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Paste Table Section */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              All Pastes
              {pastesData && (
                <span className="ml-2 text-xs font-normal">
                  ({pastesData.total} total)
                </span>
              )}
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkDelete()}
                disabled={selectedIds.size > 100}
                className="rounded"
              >
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <PasteFilters
              filters={filters}
              onFilterChange={(f) => {
                setFilters(f);
                setSelectedIds(new Set());
              }}
              languages={languages}
            />
            {pastesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : pastesData ? (
              <PasteTable
                pastes={pastesData.pastes}
                total={pastesData.total}
                page={pastesData.page}
                totalPages={pastesData.total_pages}
                filters={filters}
                onFilterChange={(f) => {
                  setFilters(f);
                  setSelectedIds(new Set());
                }}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onDeleteSingle={handleDeleteSingle}
              />
            ) : null}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        type={deleteTarget?.type || "single"}
        id={deleteTarget?.id}
        count={deleteTarget?.ids?.length}
      />
    </div>
  );
}
