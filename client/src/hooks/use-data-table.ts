import { useState, useMemo, useCallback, useEffect } from "react";

export type Density = "compact" | "comfortable";

const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export { PAGE_SIZES };

interface UseDataTableOptions {
  storageKey: string;
  defaultPageSize?: PageSize;
  defaultDensity?: Density;
  defaultViewMode?: string;
  getId: (item: any) => string;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return JSON.parse(stored);
  } catch {}
  return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function useDataTable<T>(
  data: T[] | undefined,
  options: UseDataTableOptions
) {
  const {
    storageKey,
    defaultPageSize = 25,
    defaultDensity = "comfortable",
    defaultViewMode = "cards",
    getId,
  } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSize>(
    () => loadFromStorage(`${storageKey}_pageSize`, defaultPageSize)
  );
  const [density, setDensityState] = useState<Density>(
    () => loadFromStorage(`${storageKey}_density`, defaultDensity)
  );
  const [viewMode, setViewModeState] = useState<string>(
    () => loadFromStorage(`${storageKey}_viewMode`, defaultViewMode)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalItems = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [totalItems]);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const currentPageIds = useMemo(
    () => new Set(paginatedData.map(getId)),
    [paginatedData, getId]
  );

  const setPageSize = useCallback(
    (size: PageSize) => {
      setPageSizeState(size);
      saveToStorage(`${storageKey}_pageSize`, size);
      setPage(1);
    },
    [storageKey]
  );

  const setDensity = useCallback(
    (d: Density) => {
      setDensityState(d);
      saveToStorage(`${storageKey}_density`, d);
    },
    [storageKey]
  );

  const setViewMode = useCallback(
    (mode: string) => {
      setViewModeState(mode);
      saveToStorage(`${storageKey}_viewMode`, mode);
    },
    [storageKey]
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allOnPageSelected = Array.from(currentPageIds).every((id) => prev.has(id));
      if (allOnPageSelected) {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, [currentPageIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = currentPageIds.size > 0 && Array.from(currentPageIds).every((id) => selectedIds.has(id));
  const isPartiallySelected = !isAllSelected && Array.from(currentPageIds).some((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalPages,
    totalItems,
    paginatedData,

    selectedIds,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    isPartiallySelected,
    selectedCount,

    density,
    setDensity,

    viewMode,
    setViewMode,

    currentPageIds,
  };
}
