import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import {
  DEFAULT_VENDOR_FILTERS,
  filtersAreEqual,
  mergeVendorFilters,
  parseVendorFilters,
  stringifyVendorFilters,
  toVendorListQuery,
  type VendorFilters,
} from '../utils/vendorFilters.url'

const UTILS: UrlFilterUtils<VendorFilters> = {
  defaults: DEFAULT_VENDOR_FILTERS,
  parse: parseVendorFilters,
  stringify: stringifyVendorFilters,
  merge: mergeVendorFilters,
  equals: filtersAreEqual,
}

export function useVendorFilters() {
  const base = useUrlFilters<VendorFilters>({
    ...UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery = useMemo(
    () => toVendorListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return { ...base, apiQuery }
}
