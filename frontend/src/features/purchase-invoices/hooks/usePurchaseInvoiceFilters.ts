import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import type { PurchaseInvoiceFilters } from '../types/purchaseInvoiceFilters.types'
import type { PurchaseInvoiceListQuery } from '../types/purchaseInvoiceFilters.types'
import {
  DEFAULT_PURCHASE_INVOICE_FILTERS,
  filtersAreEqual,
  mergePurchaseInvoiceFilters,
  parsePurchaseInvoiceFilters,
  stringifyPurchaseInvoiceFilters,
  toPurchaseInvoiceListQuery,
} from '../utils/purchaseInvoiceFilters.url'

const PI_FILTER_UTILS: UrlFilterUtils<PurchaseInvoiceFilters> = {
  defaults: DEFAULT_PURCHASE_INVOICE_FILTERS,
  parse: parsePurchaseInvoiceFilters,
  stringify: stringifyPurchaseInvoiceFilters,
  merge: mergePurchaseInvoiceFilters,
  equals: filtersAreEqual,
}

export function usePurchaseInvoiceFilters() {
  const base = useUrlFilters<PurchaseInvoiceFilters>({
    ...PI_FILTER_UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery: PurchaseInvoiceListQuery = useMemo(
    () => toPurchaseInvoiceListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return {
    ...base,
    apiQuery,
  }
}
