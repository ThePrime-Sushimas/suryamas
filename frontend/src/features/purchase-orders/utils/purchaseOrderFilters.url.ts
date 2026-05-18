import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import { PO_STATUS_CONFIG } from '../constants'
import type {
  PurchaseOrderFilters,
  PurchaseOrderFilterPatch,
  PurchaseOrderListQuery,
  PurchaseOrderListTab,
  PurchaseOrderSortField,
  PurchaseOrderSortOrder,
} from '../types/purchaseOrderFilters.types'

export const DEFAULT_PURCHASE_ORDER_FILTERS: PurchaseOrderFilters = {
  page: 1,
  limit: 25,
  search: '',
  status: '',
  supplierId: '',
  branchId: '',
  tab: 'all',
  sortBy: 'order_date',
  sortOrder: 'desc',
  dateFrom: '',
  dateTo: '',
}

const VALID_TABS = new Set<PurchaseOrderListTab>(['all', 'active', 'receiving', 'done'])
const VALID_SORT_FIELDS = new Set<PurchaseOrderSortField>([
  'order_date',
  'po_number',
  'total_amount',
  'created_at',
])
const VALID_SORT_ORDERS = new Set<PurchaseOrderSortOrder>(['asc', 'desc'])
const VALID_STATUSES = new Set(Object.keys(PO_STATUS_CONFIG))

const FILTER_KEYS_RESET_PAGE: (keyof PurchaseOrderFilters)[] = [
  'search',
  'status',
  'supplierId',
  'branchId',
  'tab',
  'sortBy',
  'sortOrder',
  'dateFrom',
  'dateTo',
  'limit',
]

/** Tab presets — status filter on URL takes precedence when set explicitly */
export const PO_LIST_TAB_STATUS: Record<PurchaseOrderListTab, string | undefined> = {
  all: undefined,
  active: 'DRAFT,SENT,ORDERED',
  receiving: 'PARTIAL_RECEIVED',
  done: 'FULLY_RECEIVED,CLOSED,CANCELLED',
}

export function parsePurchaseOrderFilters(searchParams: URLSearchParams): PurchaseOrderFilters {
  const statusRaw = searchParams.get('status') ?? ''
  const status = statusRaw && VALID_STATUSES.has(statusRaw) ? statusRaw : ''

  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_PURCHASE_ORDER_FILTERS.page),
    limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_PURCHASE_ORDER_FILTERS.limit, 100),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    status,
    supplierId: parseString(searchParams.get('supplier_id')),
    branchId: parseString(searchParams.get('branch_id')),
    tab: parseEnum(searchParams.get('tab'), VALID_TABS, DEFAULT_PURCHASE_ORDER_FILTERS.tab),
    sortBy: parseEnum(searchParams.get('sort_by'), VALID_SORT_FIELDS, DEFAULT_PURCHASE_ORDER_FILTERS.sortBy),
    sortOrder: parseEnum(searchParams.get('sort_order'), VALID_SORT_ORDERS, DEFAULT_PURCHASE_ORDER_FILTERS.sortOrder),
    dateFrom: parseString(searchParams.get('date_from')),
    dateTo: parseString(searchParams.get('date_to')),
  }
}

export function stringifyPurchaseOrderFilters(filters: PurchaseOrderFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_PURCHASE_ORDER_FILTERS

  const page = serializeNumber(filters.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(filters.limit, d.limit)
  if (limit) params.set('limit', limit)
  const search = serializeString(filters.search)
  if (search) params.set('search', search)
  const status = serializeString(filters.status)
  if (status) params.set('status', status)
  const supplierId = serializeString(filters.supplierId)
  if (supplierId) params.set('supplier_id', supplierId)
  const branchId = serializeString(filters.branchId)
  if (branchId) params.set('branch_id', branchId)
  if (filters.tab !== d.tab) params.set('tab', filters.tab)
  if (filters.sortBy !== d.sortBy) params.set('sort_by', filters.sortBy)
  if (filters.sortOrder !== d.sortOrder) params.set('sort_order', filters.sortOrder)
  const dateFrom = serializeString(filters.dateFrom)
  if (dateFrom) params.set('date_from', dateFrom)
  const dateTo = serializeString(filters.dateTo)
  if (dateTo) params.set('date_to', dateTo)

  return params
}

export function mergePurchaseOrderFilters(
  current: PurchaseOrderFilters,
  patch: PurchaseOrderFilterPatch,
): PurchaseOrderFilters {
  let next = mergeWithPageReset(
    current,
    patch,
    DEFAULT_PURCHASE_ORDER_FILTERS,
    FILTER_KEYS_RESET_PAGE,
  )

  if ('tab' in patch && patch.tab !== undefined && patch.tab !== current.tab && patch.status === undefined) {
    next = { ...next, status: '' }
  }

  if ('status' in patch && patch.status !== undefined && patch.status !== current.status) {
    next = { ...next, tab: 'all' }
  }

  return next
}

/** Effective status sent to API (explicit status wins over tab preset) */
export function resolveListStatus(filters: PurchaseOrderFilters): string | undefined {
  if (filters.status) return filters.status
  return PO_LIST_TAB_STATUS[filters.tab]
}

/** Map URL filter state → existing API query shape */
export function toPurchaseOrderListQuery(
  filters: PurchaseOrderFilters,
  debouncedSearch?: string,
): PurchaseOrderListQuery {
  const search = (debouncedSearch ?? filters.search).trim()
  const status = resolveListStatus(filters)

  return {
    page: filters.page,
    limit: filters.limit,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
    ...(filters.branchId ? { branch_id: filters.branchId } : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
  }
}

export function filtersAreEqual(a: PurchaseOrderFilters, b: PurchaseOrderFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyPurchaseOrderFilters)
}
