import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import { GP_LIST_STATUS_PRESETS, type GpListStatusPreset } from '../constants'
import type {
  GoodsProcessingFilterPatch,
  GoodsProcessingFilters,
  GoodsProcessingListQuery,
} from '../types/goodsProcessingFilters.types'

export const DEFAULT_GOODS_PROCESSING_FILTERS: GoodsProcessingFilters = {
  page: 1,
  limit: 25,
  search: '',
  status: '',
}

const VALID_STATUS_PRESETS = new Set<GpListStatusPreset>(
  GP_LIST_STATUS_PRESETS.map((p) => p.value),
)

const MAX_LIST_LIMIT = 100

const FILTER_KEYS_RESET_PAGE: (keyof GoodsProcessingFilters)[] = [
  'search',
  'status',
  'limit',
]

export function parseGoodsProcessingFilters(searchParams: URLSearchParams): GoodsProcessingFilters {
  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_GOODS_PROCESSING_FILTERS.page),
    limit: parsePositiveInt(
      searchParams.get('limit'),
      DEFAULT_GOODS_PROCESSING_FILTERS.limit,
      MAX_LIST_LIMIT,
    ),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    status: parseEnum(
      searchParams.get('status'),
      VALID_STATUS_PRESETS,
      DEFAULT_GOODS_PROCESSING_FILTERS.status,
    ),
  }
}

export function stringifyGoodsProcessingFilters(filters: GoodsProcessingFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_GOODS_PROCESSING_FILTERS

  const page = serializeNumber(filters.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(filters.limit, d.limit)
  if (limit) params.set('limit', limit)
  const search = serializeString(filters.search)
  if (search) params.set('search', search)
  const status = serializeString(filters.status)
  if (status) params.set('status', status)

  return params
}

export function mergeGoodsProcessingFilters(
  current: GoodsProcessingFilters,
  patch: GoodsProcessingFilterPatch,
): GoodsProcessingFilters {
  let next = mergeWithPageReset(
    current,
    patch,
    DEFAULT_GOODS_PROCESSING_FILTERS,
    FILTER_KEYS_RESET_PAGE,
  )

  if ('limit' in patch && patch.limit !== undefined) {
    next = { ...next, limit: Math.min(MAX_LIST_LIMIT, Math.max(1, patch.limit)) }
  }

  return next
}

export function toGoodsProcessingListQuery(
  filters: GoodsProcessingFilters,
  debouncedSearch?: string,
): GoodsProcessingListQuery {
  const search = (debouncedSearch ?? filters.search).trim()
  return {
    page: filters.page,
    limit: Math.min(MAX_LIST_LIMIT, Math.max(1, filters.limit)),
    ...(search ? { search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }
}

export function filtersAreEqual(a: GoodsProcessingFilters, b: GoodsProcessingFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyGoodsProcessingFilters)
}
