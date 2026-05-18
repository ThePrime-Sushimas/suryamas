import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import type { PurchaseOrderFilters } from '../types/purchaseOrderFilters.types'
import {
  DEFAULT_PURCHASE_ORDER_FILTERS,
  filtersAreEqual,
  mergePurchaseOrderFilters,
  parsePurchaseOrderFilters,
  stringifyPurchaseOrderFilters,
  toPurchaseOrderListQuery,
} from '../utils/purchaseOrderFilters.url'
import type { PurchaseOrderListQuery } from '../types/purchaseOrderFilters.types'

const PO_FILTER_UTILS: UrlFilterUtils<PurchaseOrderFilters> = {
  defaults: DEFAULT_PURCHASE_ORDER_FILTERS,
  parse: parsePurchaseOrderFilters,
  stringify: stringifyPurchaseOrderFilters,
  merge: mergePurchaseOrderFilters,
  equals: filtersAreEqual,
}

/** Purchase-order list filters synced to URL (wraps shared useUrlFilters). */
export function usePurchaseOrderFilters() {
  const base = useUrlFilters<PurchaseOrderFilters>({
    ...PO_FILTER_UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery: PurchaseOrderListQuery = useMemo(
    () => toPurchaseOrderListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return {
    ...base,
    apiQuery,
  }
}
