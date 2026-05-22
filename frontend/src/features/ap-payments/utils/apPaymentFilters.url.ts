import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import {
  AP_LIST_TAB_STATUS,
  AP_LIST_TABS,
  type ApPaymentListTab,
} from '../constants'
import type {
  ApPaymentFilterPatch,
  ApPaymentFilters,
  ApPaymentListQuery,
} from '../types/apPaymentFilters.types'
import type { ApPaymentMethod, ApPaymentStatus } from '../api/apPayments.api'
import { AP_PAYMENT_METHOD_LABELS, AP_STATUS_CONFIG } from '../constants'

export const DEFAULT_AP_PAYMENT_FILTERS: ApPaymentFilters = {
  page: 1,
  limit: 25,
  search: '',
  status: '',
  supplierId: '',
  branchId: '',
  paymentMethod: '',
  tab: 'outstanding',
  dateFrom: '',
  dateTo: '',
  bulkOnly: false,
}

const VALID_TABS = new Set<ApPaymentListTab>(AP_LIST_TABS.map((t) => t.id))
const VALID_STATUSES = new Set(Object.keys(AP_STATUS_CONFIG) as ApPaymentStatus[])
const VALID_METHODS = new Set(Object.keys(AP_PAYMENT_METHOD_LABELS) as ApPaymentMethod[])

const MAX_LIST_LIMIT = 100

const FILTER_KEYS_RESET_PAGE: (keyof ApPaymentFilters)[] = [
  'search',
  'status',
  'supplierId',
  'branchId',
  'paymentMethod',
  'tab',
  'dateFrom',
  'dateTo',
  'bulkOnly',
  'limit',
]

export function parseApPaymentFilters(searchParams: URLSearchParams): ApPaymentFilters {
  const statusRaw = searchParams.get('status') ?? ''
  const status =
    statusRaw && VALID_STATUSES.has(statusRaw as ApPaymentStatus)
      ? (statusRaw as ApPaymentStatus)
      : ''

  const methodRaw = searchParams.get('payment_method') ?? ''
  const paymentMethod =
    methodRaw && VALID_METHODS.has(methodRaw as ApPaymentMethod)
      ? (methodRaw as ApPaymentMethod)
      : ''

  const bulkOnlyRaw = searchParams.get('bulk_only')
  const bulkOnly = bulkOnlyRaw === 'true'

  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_AP_PAYMENT_FILTERS.page),
    limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_AP_PAYMENT_FILTERS.limit, MAX_LIST_LIMIT),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    status,
    supplierId: parseString(searchParams.get('supplier_id')),
    branchId: parseString(searchParams.get('branch_id')),
    paymentMethod,
    tab: parseEnum(searchParams.get('tab'), VALID_TABS, DEFAULT_AP_PAYMENT_FILTERS.tab),
    dateFrom: parseString(searchParams.get('date_from')),
    dateTo: parseString(searchParams.get('date_to')),
    bulkOnly,
  }
}

export function stringifyApPaymentFilters(filters: ApPaymentFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_AP_PAYMENT_FILTERS

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
  const paymentMethod = serializeString(filters.paymentMethod)
  if (paymentMethod) params.set('payment_method', paymentMethod)
  if (filters.tab !== d.tab) params.set('tab', filters.tab)
  const dateFrom = serializeString(filters.dateFrom)
  if (dateFrom) params.set('date_from', dateFrom)
  const dateTo = serializeString(filters.dateTo)
  if (dateTo) params.set('date_to', dateTo)
  if (filters.bulkOnly) params.set('bulk_only', 'true')

  return params
}

export function mergeApPaymentFilters(
  current: ApPaymentFilters,
  patch: ApPaymentFilterPatch,
): ApPaymentFilters {
  let next = mergeWithPageReset(current, patch, DEFAULT_AP_PAYMENT_FILTERS, FILTER_KEYS_RESET_PAGE)

  if ('tab' in patch && patch.tab !== undefined && patch.tab !== current.tab && patch.status === undefined) {
    next = { ...next, status: '' }
  }

  if ('status' in patch && patch.status !== undefined && patch.status !== current.status) {
    next = { ...next, tab: 'all' }
  }

  if ('limit' in patch && patch.limit !== undefined) {
    next = { ...next, limit: Math.min(MAX_LIST_LIMIT, Math.max(1, patch.limit)) }
  }

  return next
}

export function resolveListStatus(filters: ApPaymentFilters): ApPaymentStatus | undefined {
  if (filters.status) return filters.status
  const fromTab = AP_LIST_TAB_STATUS[filters.tab]
  return fromTab || undefined
}

/** Tab pill active when it matches explicit status or current tab (no status override). */
export function isApListTabActive(tabId: ApPaymentListTab, filters: ApPaymentFilters): boolean {
  if (filters.status) return AP_LIST_TAB_STATUS[tabId] === filters.status
  return filters.tab === tabId
}

/** Returns true when both dates are non-empty and dateFrom is after dateTo. */
export function isDateRangeInvalid(dateFrom: string, dateTo: string): boolean {
  return !!(dateFrom && dateTo && dateFrom > dateTo)
}

export function toApPaymentListQuery(
  filters: ApPaymentFilters,
  debouncedSearch?: string,
): ApPaymentListQuery {
  const search = (debouncedSearch ?? filters.search).trim()
  const status = resolveListStatus(filters)

  // When date range is invalid, exclude both date params from the API request
  const dateInvalid = isDateRangeInvalid(filters.dateFrom, filters.dateTo)

  return {
    page: filters.page,
    limit: Math.min(MAX_LIST_LIMIT, Math.max(1, filters.limit)),
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
    ...(filters.branchId ? { branch_id: filters.branchId } : {}),
    ...(filters.paymentMethod ? { payment_method: filters.paymentMethod } : {}),
    ...(!dateInvalid && filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(!dateInvalid && filters.dateTo ? { date_to: filters.dateTo } : {}),
    ...(filters.bulkOnly ? { bulk_only: true } : {}),
  }
}

export function filtersAreEqual(a: ApPaymentFilters, b: ApPaymentFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyApPaymentFilters)
}
