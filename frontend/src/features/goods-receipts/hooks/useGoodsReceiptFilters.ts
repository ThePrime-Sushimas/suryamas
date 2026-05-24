import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import type { GoodsReceiptFilters } from '../types/goodsReceiptFilters.types'
import type { GoodsReceiptListQuery } from '../types/goodsReceiptFilters.types'
import {
  DEFAULT_GOODS_RECEIPT_FILTERS,
  filtersAreEqual,
  mergeGoodsReceiptFilters,
  parseGoodsReceiptFilters,
  stringifyGoodsReceiptFilters,
  toGoodsReceiptListQuery,
} from '../utils/goodsReceiptFilters.url'

const GR_FILTER_UTILS: UrlFilterUtils<GoodsReceiptFilters> = {
  defaults: DEFAULT_GOODS_RECEIPT_FILTERS,
  parse: parseGoodsReceiptFilters,
  stringify: stringifyGoodsReceiptFilters,
  merge: mergeGoodsReceiptFilters,
  equals: filtersAreEqual,
}

export function useGoodsReceiptFilters() {
  const base = useUrlFilters<GoodsReceiptFilters>({
    ...GR_FILTER_UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery: GoodsReceiptListQuery = useMemo(
    () => toGoodsReceiptListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return {
    ...base,
    apiQuery,
  }
}
