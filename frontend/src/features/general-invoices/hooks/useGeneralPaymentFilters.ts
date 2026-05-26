import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import {
  DEFAULT_GENERAL_PAYMENT_FILTERS,
  filtersAreEqual,
  mergeGeneralPaymentFilters,
  parseGeneralPaymentFilters,
  stringifyGeneralPaymentFilters,
  toGeneralPaymentListQuery,
  type GeneralPaymentFilters,
} from '../utils/generalPaymentFilters.url'

const UTILS: UrlFilterUtils<GeneralPaymentFilters> = {
  defaults: DEFAULT_GENERAL_PAYMENT_FILTERS,
  parse: parseGeneralPaymentFilters,
  stringify: stringifyGeneralPaymentFilters,
  merge: mergeGeneralPaymentFilters,
  equals: filtersAreEqual,
}

export function useGeneralPaymentFilters() {
  const base = useUrlFilters<GeneralPaymentFilters>({
    ...UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery = useMemo(
    () => toGeneralPaymentListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return { ...base, apiQuery }
}
