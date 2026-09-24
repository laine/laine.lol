const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/v1";

export interface StatsResponse {
  total_pastes: number;
  pending_expiration: number;
  burn_after_read_count: number;
  total_size: number;
  language_stats: Record<string, number>;
  pastes_over_time: { date: string; count: number }[];
}

export interface PasteListItem {
  id: string;
  language: string;
  created_at: string;
  size: number;
  type: string;
  burn_after_read: boolean;
  has_expiration: boolean;
  expires_at: string | null;
  encryption_version: number;
}

export interface PasteListResponse {
  pastes: PasteListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PasteFilterParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "ASC" | "DESC";
  language?: string;
  type?: string;
  burn?: boolean;
  expiration?: boolean;
  search?: string;
  start_date?: number;
  end_date?: number;
}

export interface BulkDeleteResponse {
  success: boolean;
  deleted_count: number;
  not_found: string[];
}

/** Authenticate with the admin secret. */
export async function login(secret: string): Promise<{ success: boolean; expires_at: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ secret }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(body.error || "Login failed");
  }
  return res.json();
}

/** Clear the admin session. */
export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/admin/logout`, {
    method: "POST",
    credentials: "include",
  });
}

/** Fetch dashboard statistics for a given time range. */
export async function fetchStats(
  range: string = "7d",
  start?: number,
  end?: number
): Promise<StatsResponse> {
  const params = new URLSearchParams({ range });
  if (start !== undefined) params.set("start", String(start));
  if (end !== undefined) params.set("end", String(end));

  const res = await fetch(`${API_BASE_URL}/admin/stats?${params}`, {
    credentials: "include",
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Failed to fetch stats" }));
    throw new Error(body.error || "Failed to fetch stats");
  }
  return res.json();
}

/** Fetch a filtered, paginated list of pastes. */
export async function fetchPastes(filters: PasteFilterParams = {}): Promise<PasteListResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.language) params.set("language", filters.language);
  if (filters.type) params.set("type", filters.type);
  if (filters.burn !== undefined) params.set("burn", String(filters.burn));
  if (filters.expiration !== undefined) params.set("expiration", String(filters.expiration));
  if (filters.search) params.set("search", filters.search);
  if (filters.start_date) params.set("start_date", String(filters.start_date));
  if (filters.end_date) params.set("end_date", String(filters.end_date));

  const res = await fetch(`${API_BASE_URL}/admin/pastes?${params}`, {
    credentials: "include",
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Failed to fetch pastes" }));
    throw new Error(body.error || "Failed to fetch pastes");
  }
  return res.json();
}

/** Delete a single paste by ID. */
export async function deletePaste(id: string): Promise<{ success: boolean; deleted_id: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/pastes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 404) throw new Error("Paste not found");
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(body.error || "Delete failed");
  }
  return res.json();
}

/** Bulk delete multiple pastes by IDs. */
export async function bulkDeletePastes(ids: string[]): Promise<BulkDeleteResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/pastes`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Bulk delete failed" }));
    throw new Error(body.error || "Bulk delete failed");
  }
  return res.json();
}

/** Check if the current session is authenticated by trying to fetch stats. */
export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/stats?range=7d`, {
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
