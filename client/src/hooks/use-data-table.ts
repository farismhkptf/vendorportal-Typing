import { useState, useMemo, useCallback, useEffect } from "react";

export type Density = "compact" | "comfortable";
export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export { PAGE_SIZES };

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible?: boolean;
}

interface UseDataTableOptions {
  storageKey: string;
  defaultPageSize?: PageSize;
  defaultDensity?: Density;
  defaultViewMode?: string;
  getId: (item: any) => string;
  columns?: ColumnDef[];
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
    columns,
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
  const [sort, setSortState] = useState<SortState>(
    () => loadFromStorage(`${storageKey}_sort`, { key: null, direction: null })
  );
  const [hiddenColumns, setHiddenColumnsState] = useState<Set<string>>(
    () => {
      const stored = loadFromStorage<string[]>(`${storageKey}_hiddenCols`, []);
      if (stored.length > 0) return new Set(stored);
      if (columns) {
        const hidden = columns.filter(c => c.defaultVisible === false).map(c => c.id);
        return new Set(hidden);
      }
      return new Set<string>();
    }
  );

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

  const toggleSort = useCallback(
    (key: string) => {
      setSortState((prev) => {
        let next: SortState;
        if (prev.key === key) {
          if (prev.direction === "asc") next = { key, direction: "desc" };
          else if (prev.direction === "desc") next = { key: null, direction: null };
          else next = { key, direction: "asc" };
        } else {
          next = { key, direction: "asc" };
        }
        saveToStorage(`${storageKey}_sort`, next);
        return next;
      });
      setPage(1);
    },
    [storageKey]
  );

  const isColumnVisible = useCallback(
    (colId: string) => !hiddenColumns.has(colId),
    [hiddenColumns]
  );

  const toggleColumn = useCallback(
    (colId: string) => {
      setHiddenColumnsState((prev) => {
        const next = new Set(prev);
        if (next.has(colId)) next.delete(colId);
        else next.add(colId);
        saveToStorage(`${storageKey}_hiddenCols`, Array.from(next));
        return next;
      });
    },
    [storageKey]
  );

  const resetColumns = useCallback(() => {
    const defaults = columns
      ? new Set(columns.filter(c => c.defaultVisible === false).map(c => c.id))
      : new Set<string>();
    setHiddenColumnsState(defaults);
    saveToStorage(`${storageKey}_hiddenCols`, Array.from(defaults));
  }, [storageKey, columns]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "Escape") {
        if (selectedCount > 0) {
          e.preventDefault();
          clearSelection();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && currentPageIds.size > 0) {
        e.preventDefault();
        if (!isAllSelected) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            currentPageIds.forEach((id) => next.add(id));
            return next;
          });
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedCount, clearSelection, currentPageIds, isAllSelected]);

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

    sort,
    toggleSort,

    columns: columns || [],
    isColumnVisible,
    toggleColumn,
    resetColumns,
    hiddenColumns,
  };
}
