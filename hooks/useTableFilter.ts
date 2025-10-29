// hooks/useTableFilters.ts
import { useQueryString, useQueryNumber, useQueryJSON } from './useQueryState';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface BaseFilters {
  search: string;
  page: number;
  limit: number;
  sort: SortConfig;
}

// Type utilities
type CustomFilters<T> = Omit<T, keyof BaseFilters>;
type CustomFilterKeys<T> = (keyof CustomFilters<T>)[];

export function useTableFilters<T extends BaseFilters>(
  defaultFilters: T,
  customFilterKeys: CustomFilterKeys<T> = []
) {
  // Base filters - selalu ada
  const [search, setSearch] = useQueryString('search', defaultFilters.search);
  const [page, setPage] = useQueryNumber('page', defaultFilters.page);
  const [limit, setLimit] = useQueryNumber('limit', defaultFilters.limit);
  const [sort, setSort] = useQueryJSON<SortConfig>('sort', defaultFilters.sort);

  // 🔥 FIX: Initialize custom filters secara individual
  const customFilterStates = {} as Record<keyof CustomFilters<T>, ReturnType<typeof useQueryString>>;

  // Inisialisasi masing-masing custom filter
  customFilterKeys.forEach(key => {
    // ✅ BENAR: Setiap hook dipanggil secara kondisional tapi di level yang sama
    customFilterStates[key] = useQueryString(
      key as string, 
      (defaultFilters[key] as string) || ''
    );
  });

  // Bulk update
  const setFilters = (updates: Partial<T>) => {
    if (updates.search !== undefined) setSearch(updates.search);
    if (updates.page !== undefined) setPage(updates.page);
    if (updates.limit !== undefined) setLimit(updates.limit);
    if (updates.sort !== undefined) setSort(updates.sort);

    // Update custom filters
    Object.entries(updates).forEach(([key, value]) => {
      if (key in customFilterStates && value !== undefined) {
        customFilterStates[key as keyof CustomFilters<T>][1](value as string);
      }
    });
  };

  // Reset to defaults
  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  // Build current filters object
  const currentFilters = {
    search,
    page,
    limit,
    sort,
    ...Object.keys(customFilterStates).reduce((acc, key) => {
      acc[key] = customFilterStates[key][0];
      return acc;
    }, {} as Record<string, any>)
  } as T;

  // Check if any filters are active
  const hasActiveFilters = 
    search !== defaultFilters.search ||
    page !== defaultFilters.page ||
    Object.values(customFilterStates).some(([value], index) => {
      const key = customFilterKeys[index];
      return value !== defaultFilters[key as keyof T];
    });

  // Build return object dengan type yang proper
  const result = {
    // State values
    ...currentFilters,
    
    // Base setters
    setSearch,
    setPage, 
    setLimit,
    setSort,
    
    // Custom setters
    ...customFilterKeys.reduce((acc, key) => {
      acc[`set${String(key).charAt(0).toUpperCase() + String(key).slice(1)}`] = 
        customFilterStates[key][1];
      return acc;
    }, {} as Record<string, (value: string) => void>),
    
    // Utilities
    setFilters,
    resetFilters,
    hasActiveFilters,
    currentFilters
  };

  return result;
}