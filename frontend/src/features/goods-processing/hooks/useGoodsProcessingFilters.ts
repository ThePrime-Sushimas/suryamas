import { useMemo } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import type { GoodsProcessingFilters } from '../types/goodsProcessingFilters.types'
import type { GoodsProcessingListQuery } from '../types/goodsProcessingFilters.types'
import {
  DEFAULT_GOODS_PROCESSING_FILTERS,
  filtersAreEqual,
  mergeGoodsProcessingFilters,
  parseGoodsProcessingFilters,
  stringifyGoodsProcessingFilters,
  toGoodsProcessingListQuery,
} from '../utils/goodsProcessingFilters.url'

const GP_FILTER_UTILS: UrlFilterUtils<GoodsProcessingFilters> = {
  defaults: DEFAULT_GOODS_PROCESSING_FILTERS,
  parse: parseGoodsProcessingFilters,
  stringify: stringifyGoodsProcessingFilters,
  merge: mergeGoodsProcessingFilters,
  equals: filtersAreEqual,
}

export function useGoodsProcessingFilters() {
  const base = useUrlFilters<GoodsProcessingFilters>({
    ...GP_FILTER_UTILS,
    searchField: 'search',
    debounceMs: 400,
  })

  const apiQuery: GoodsProcessingListQuery = useMemo(
    () => toGoodsProcessingListQuery(base.filters, base.debouncedSearch),
    [base.filters, base.debouncedSearch],
  )

  return {
    ...base,
    apiQuery,
  }
}
