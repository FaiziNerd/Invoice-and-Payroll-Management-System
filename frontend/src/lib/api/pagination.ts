export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export function parseListParams(url: URL) {
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE
    )
  );
  const cursor = url.searchParams.get("cursor")?.trim() || null;
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const trashOnly = url.searchParams.get("trash") === "true";
  return { limit, cursor, includeDeleted, trashOnly };
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

export function decodeCursor(
  cursor: string
): { createdAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0) return null;
    const createdAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function buildPaginatedResponse<T extends { createdAt: string; id: string }>(
  rows: T[],
  limit: number
): PaginatedResponse<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    hasMore,
    limit,
  };
}

export function applyCursorFilter<
  T extends {
    or: (filters: string) => T;
  },
>(query: T, cursor: string | null, createdAtColumn = "created_at"): T {
  if (!cursor) return query;
  const decoded = decodeCursor(cursor);
  if (!decoded) return query;
  return query.or(
    `${createdAtColumn}.lt.${decoded.createdAt},and(${createdAtColumn}.eq.${decoded.createdAt},id.lt.${decoded.id})`
  );
}

export function applySoftDeleteFilter<
  T extends {
    is: (column: string, value: null) => T;
    not: (column: string, operator: string, value: null) => T;
  },
>(query: T, options: { includeDeleted?: boolean; trashOnly?: boolean }): T {
  if (options.trashOnly) {
    return query.not("deleted_at", "is", null);
  }
  if (options.includeDeleted) {
    return query;
  }
  return query.is("deleted_at", null);
}
