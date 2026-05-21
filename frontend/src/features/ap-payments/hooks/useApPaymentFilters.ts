import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import type { ApPaymentFilters } from '../types/apPaymentFilters.types'
import type { ApPaymentListQuery } from '../types/apPaymentFilters.types'
import {
  DEFAULT_AP_PAYMENT_FILTERS,
  filtersAreEqual,
  mergeApPaymentFilters,
  parseApPaymentFilters,
  stringifyApPaymentFilters,
  toApPaymentListQuery,
} from '../utils/apPaymentFilters.url'

const AP_FILTER_UTILS: UrlFilterUtils<ApPaymentFilters> = {
  defaults: DEFAULT_AP_PAYMENT_FILTERS,
  parse: parseApPaymentFilters,
  stringify: stringifyApPaymentFilters,
  merge: mergeApPaymentFilters,
  equals: filtersAreEqual,
}

export function useApPaymentFilters() {
  const base = useUrlFilters<ApPaymentFilters>({
    ...AP_FILTER_UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery: ApPaymentListQuery = useMemo(
    () => toApPaymentListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return {
    ...base,
    apiQuery,
  }
}
