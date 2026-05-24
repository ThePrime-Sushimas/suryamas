import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import { GR_STATUS_OPTIONS } from '../constants'
import type {
  GoodsReceiptFilterPatch,
  GoodsReceiptFilters,
  GoodsReceiptListQuery,
} from '../types/goodsReceiptFilters.types'

export const DEFAULT_GOODS_RECEIPT_FILTERS: GoodsReceiptFilters = {
  page: 1,
  limit: 25,
  search: '',
  status: '',
}

const VALID_STATUSES = new Set(GR_STATUS_OPTIONS.map((o) => o.value))
const MAX_LIST_LIMIT = 100

const FILTER_KEYS_RESET_PAGE: (keyof GoodsReceiptFilters)[] = [
  'search',
  'status',
  'limit',
]

export function parseGoodsReceiptFilters(searchParams: URLSearchParams): GoodsReceiptFilters {
  const statusRaw = searchParams.get('status') ?? ''
  const status = VALID_STATUSES.has(statusRaw as (typeof GR_STATUS_OPTIONS)[number]['value'])
    ? statusRaw
    : ''

  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_GOODS_RECEIPT_FILTERS.page),
    limit: parsePositiveInt(
      searchParams.get('limit'),
      DEFAULT_GOODS_RECEIPT_FILTERS.limit,
      MAX_LIST_LIMIT,
    ),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    status,
  }
}

export function stringifyGoodsReceiptFilters(filters: GoodsReceiptFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_GOODS_RECEIPT_FILTERS

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

export function mergeGoodsReceiptFilters(
  current: GoodsReceiptFilters,
  patch: GoodsReceiptFilterPatch,
): GoodsReceiptFilters {
  let next = mergeWithPageReset(
    current,
    patch,
    DEFAULT_GOODS_RECEIPT_FILTERS,
    FILTER_KEYS_RESET_PAGE,
  )

  if ('limit' in patch && patch.limit !== undefined) {
    next = { ...next, limit: Math.min(MAX_LIST_LIMIT, Math.max(1, patch.limit)) }
  }

  return next
}

export function toGoodsReceiptListQuery(
  filters: GoodsReceiptFilters,
  debouncedSearch?: string,
): GoodsReceiptListQuery {
  const search = (debouncedSearch ?? filters.search).trim()
  return {
    page: filters.page,
    limit: Math.min(MAX_LIST_LIMIT, Math.max(1, filters.limit)),
    ...(search ? { search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }
}

export function filtersAreEqual(a: GoodsReceiptFilters, b: GoodsReceiptFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyGoodsReceiptFilters)
}
