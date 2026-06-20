"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaginatedResponse } from "@/lib/api/pagination";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

export function usePaginatedList<T extends { id: string; createdAt: string }>(
  endpoint: string,
  options?: { trash?: boolean; enabled?: boolean }
) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = options?.enabled ?? true;

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", "25");
      if (cursor) params.set("cursor", cursor);
      if (options?.trash) params.set("trash", "true");
      return `${endpoint}?${params.toString()}`;
    },
    [endpoint, options?.trash]
  );

  const fetchPage = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!enabled) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(cursor), { credentials: "include" });
        const json = (await res.json()) as ApiResult<PaginatedResponse<T>>;
        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to load list");
        }
        setItems((prev) => (append ? [...prev, ...json.data.items] : json.data.items));
        setNextCursor(json.data.nextCursor);
        setHasMore(json.data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load list");
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildUrl, enabled]
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    await fetchPage(nextCursor, true);
  }, [fetchPage, hasMore, loadingMore, nextCursor]);

  const refresh = useCallback(async () => {
    await fetchPage(null, false);
  }, [fetchPage]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}

export type { PaginatedResponse };
