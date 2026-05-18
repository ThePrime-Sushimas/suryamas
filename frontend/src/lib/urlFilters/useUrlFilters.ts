import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebounce } from '@/hooks/_shared/useDebounce'

export type UrlFilterSetOptions = {
  /** Prefer replaceState for high-frequency updates (debounced search) */
  replace?: boolean
}

/** Minimum shape for paginated list filters (no index signature required on feature types). */
export type UrlFilterBase = {
  page: number
  limit: number
}

export type UrlFilterUtils<T extends UrlFilterBase> = {
  defaults: T
  parse: (searchParams: URLSearchParams) => T
  stringify: (filters: T) => URLSearchParams
  merge: (current: T, patch: Partial<T>) => T
  equals?: (a: T, b: T) => boolean
}

export type UseUrlFiltersConfig<T extends UrlFilterBase> = UrlFilterUtils<T> & {
  /** Field used for text search with local input + debounce (e.g. "search") */
  searchField?: keyof T & string
  debounceMs?: number
}

/** Patches accepted by setFilters / patchFilters (Partial<T> is not assignable from Pick for generic T). */
export type UrlFilterPatch<T extends UrlFilterBase> =
  | Partial<T>
  | Pick<UrlFilterBase, 'page'>
  | Pick<UrlFilterBase, 'limit'>

/**
 * Generic URL-synced list filters (React Router v6).
 * Single source of truth: URLSearchParams — no bidirectional useState sync loops.
 */
export function useUrlFilters<T extends UrlFilterBase>(config: UseUrlFiltersConfig<T>) {
  const {
    defaults,
    parse,
    stringify,
    merge,
    equals,
    searchField,
    debounceMs = 400,
  } = config

  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => parse(searchParams), [searchParams, parse])

  const initialSearch =
    searchField != null ? String(filters[searchField] ?? '') : ''
  const [searchInput, setSearchInput] = useState(initialSearch)
  const debouncedSearch = useDebounce(searchInput, debounceMs)

  useEffect(() => {
    if (searchField == null) return
    setSearchInput(String(filters[searchField] ?? ''))
  }, [searchField, filters])

  const filtersEqual = useCallback(
    (a: T, b: T) => (equals ? equals(a, b) : stringify(a).toString() === stringify(b).toString()),
    [equals, stringify],
  )

  const applyFilters = useCallback(
    (next: T, options?: UrlFilterSetOptions) => {
      setSearchParams(stringify(next), { replace: options?.replace ?? false })
    },
    [setSearchParams, stringify],
  )

  const patchFilters = useCallback(
    (patch: UrlFilterPatch<T>, options?: UrlFilterSetOptions) => {
      const next = merge(filters, patch as Partial<T>)
      if (filtersEqual(filters, next)) return
      applyFilters(next, options)
    },
    [filters, merge, filtersEqual, applyFilters],
  )

  useEffect(() => {
    if (searchField == null) return
    const trimmed = debouncedSearch.trim()
    const current = String(filters[searchField] ?? '').trim()
    if (trimmed === current) return
    patchFilters({ [searchField]: trimmed } as Partial<T>, { replace: true })
  }, [debouncedSearch, searchField, filters, patchFilters])

  const setFilters = useCallback(
    (patch: UrlFilterPatch<T>, options?: UrlFilterSetOptions) => {
      const partial = patch as Partial<T>
      if (searchField != null && searchField in partial && partial[searchField] !== undefined) {
        setSearchInput(String(partial[searchField]))
      }
      patchFilters(patch, options)
    },
    [patchFilters, searchField],
  )

  const resetFilters = useCallback(() => {
    if (searchField != null) {
      setSearchInput(String(defaults[searchField] ?? ''))
    }
    applyFilters(defaults, { replace: true })
  }, [applyFilters, defaults, searchField])

  const listSearchSuffix = useMemo(() => {
    const qs = stringify(filters).toString()
    return qs ? `?${qs}` : ''
  }, [filters, stringify])

  return {
    filters,
    searchInput,
    setSearchInput,
    debouncedSearch: searchField != null ? debouncedSearch : undefined,
    listSearchSuffix,
    setFilters,
    patchFilters,
    resetFilters,
    setPage: (page: number) => patchFilters({ page }),
    setLimit: (limit: number) => patchFilters({ limit }),
  }
}
