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
  PI_LIST_TAB_STATUS,
  type PurchaseInvoiceListTab,
} from '../constants'
import type {
  PurchaseInvoiceFilterPatch,
  PurchaseInvoiceFilters,
  PurchaseInvoiceListQuery,
} from '../types/purchaseInvoiceFilters.types'

export const DEFAULT_PURCHASE_INVOICE_FILTERS: PurchaseInvoiceFilters = {
  page: 1,
  limit: 25,
  search: '',
  supplierId: '',
  branchId: '',
  tab: 'verify',
}

const VALID_TABS = new Set<PurchaseInvoiceListTab>(Object.keys(PI_LIST_TAB_STATUS) as PurchaseInvoiceListTab[])

const MAX_LIST_LIMIT = 100

const FILTER_KEYS_RESET_PAGE: (keyof PurchaseInvoiceFilters)[] = [
  'search',
  'supplierId',
  'branchId',
  'tab',
  'limit',
]

export function parsePurchaseInvoiceFilters(searchParams: URLSearchParams): PurchaseInvoiceFilters {
  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_PURCHASE_INVOICE_FILTERS.page),
    limit: parsePositiveInt(
      searchParams.get('limit'),
      DEFAULT_PURCHASE_INVOICE_FILTERS.limit,
      MAX_LIST_LIMIT,
    ),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    supplierId: parseString(searchParams.get('supplier_id')),
    branchId: parseString(searchParams.get('branch_id')),
    tab: parseEnum(searchParams.get('tab'), VALID_TABS, DEFAULT_PURCHASE_INVOICE_FILTERS.tab),
  }
}

export function stringifyPurchaseInvoiceFilters(filters: PurchaseInvoiceFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_PURCHASE_INVOICE_FILTERS

  const page = serializeNumber(filters.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(filters.limit, d.limit)
  if (limit) params.set('limit', limit)
  const search = serializeString(filters.search)
  if (search) params.set('search', search)
  const supplierId = serializeString(filters.supplierId)
  if (supplierId) params.set('supplier_id', supplierId)
  const branchId = serializeString(filters.branchId)
  if (branchId) params.set('branch_id', branchId)
  if (filters.tab !== d.tab) params.set('tab', filters.tab)

  return params
}

export function mergePurchaseInvoiceFilters(
  current: PurchaseInvoiceFilters,
  patch: PurchaseInvoiceFilterPatch,
): PurchaseInvoiceFilters {
  let next = mergeWithPageReset(
    current,
    patch,
    DEFAULT_PURCHASE_INVOICE_FILTERS,
    FILTER_KEYS_RESET_PAGE,
  )

  if ('limit' in patch && patch.limit !== undefined) {
    next = { ...next, limit: Math.min(MAX_LIST_LIMIT, Math.max(1, patch.limit)) }
  }

  return next
}

export function resolveListStatus(filters: PurchaseInvoiceFilters): string {
  return PI_LIST_TAB_STATUS[filters.tab]
}

export function toPurchaseInvoiceListQuery(
  filters: PurchaseInvoiceFilters,
  debouncedSearch?: string,
): PurchaseInvoiceListQuery {
  const search = (debouncedSearch ?? filters.search).trim()
  return {
    page: filters.page,
    limit: Math.min(MAX_LIST_LIMIT, Math.max(1, filters.limit)),
    status: resolveListStatus(filters),
    ...(search ? { search } : {}),
    ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
    ...(filters.branchId ? { branch_id: filters.branchId } : {}),
  }
}

export function filtersAreEqual(a: PurchaseInvoiceFilters, b: PurchaseInvoiceFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyPurchaseInvoiceFilters)
}
