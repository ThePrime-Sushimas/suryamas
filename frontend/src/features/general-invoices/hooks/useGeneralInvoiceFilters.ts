import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import {
  DEFAULT_GENERAL_INVOICE_FILTERS,
  filtersAreEqual,
  mergeGeneralInvoiceFilters,
  parseGeneralInvoiceFilters,
  stringifyGeneralInvoiceFilters,
  toGeneralInvoiceListQuery,
  type GeneralInvoiceFilters,
} from '../utils/generalInvoiceFilters.url'

const UTILS: UrlFilterUtils<GeneralInvoiceFilters> = {
  defaults: DEFAULT_GENERAL_INVOICE_FILTERS,
  parse: parseGeneralInvoiceFilters,
  stringify: stringifyGeneralInvoiceFilters,
  merge: mergeGeneralInvoiceFilters,
  equals: filtersAreEqual,
}

export function useGeneralInvoiceFilters() {
  const base = useUrlFilters<GeneralInvoiceFilters>({
    ...UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery = useMemo(
    () => toGeneralInvoiceListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return { ...base, apiQuery }
}
