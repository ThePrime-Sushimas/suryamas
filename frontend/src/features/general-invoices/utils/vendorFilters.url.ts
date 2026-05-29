import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import type { VendorType } from '../api/generalApi.api'

export type VendorSortBy = 'vendor_name' | 'vendor_code' | 'created_at'
export type SortOrder = 'asc' | 'desc'

export interface VendorFilters {
  page: number
  limit: number
  search: string
  vendorType: VendorType | ''
  isActive: '' | 'true' | 'false'
  sortBy: VendorSortBy
  sortOrder: SortOrder
}

export const DEFAULT_VENDOR_FILTERS: VendorFilters = {
  page: 1,
  limit: 50,
  search: '',
  vendorType: '',
  isActive: 'true',
  sortBy: 'vendor_name',
  sortOrder: 'asc',
}

const VALID_VENDOR_TYPE = new Set<VendorType>(['UTILITY', 'RENT', 'SERVICE', 'SUBSCRIPTION', 'OTHER'])
const VALID_SORT_BY = new Set<VendorSortBy>(['vendor_name', 'vendor_code', 'created_at'])
const VALID_SORT_ORDER = new Set<SortOrder>(['asc', 'desc'])

const FILTER_KEYS_RESET_PAGE: (keyof VendorFilters)[] = ['search', 'vendorType', 'isActive', 'limit']

export function parseVendorFilters(searchParams: URLSearchParams): VendorFilters {
  const activeRaw = searchParams.get('is_active')
  let isActive: VendorFilters['isActive'] = 'true'
  if (activeRaw === 'false') isActive = 'false'
  else if (activeRaw === '' || activeRaw === 'all') isActive = ''

  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_VENDOR_FILTERS.page),
    limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_VENDOR_FILTERS.limit, 200),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    vendorType: parseEnum(searchParams.get('vendor_type'), VALID_VENDOR_TYPE, ''),
    isActive,
    sortBy: parseEnum(searchParams.get('sort_by'), VALID_SORT_BY, 'vendor_name'),
    sortOrder: parseEnum(searchParams.get('sort_order'), VALID_SORT_ORDER, 'asc'),
  }
}

export function stringifyVendorFilters(filters: VendorFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_VENDOR_FILTERS

  const page = serializeNumber(filters.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(filters.limit, d.limit)
  if (limit) params.set('limit', limit)
  const search = serializeString(filters.search)
  if (search) params.set('search', search)
  if (filters.vendorType) params.set('vendor_type', filters.vendorType)
  if (filters.isActive !== d.isActive) {
    if (filters.isActive === '') params.set('is_active', 'all')
    else params.set('is_active', filters.isActive)
  }
  if (filters.sortBy !== d.sortBy) params.set('sort_by', filters.sortBy)
  if (filters.sortOrder !== d.sortOrder) params.set('sort_order', filters.sortOrder)

  return params
}

export function mergeVendorFilters(current: VendorFilters, patch: Partial<VendorFilters>): VendorFilters {
  return mergeWithPageReset(current, patch, DEFAULT_VENDOR_FILTERS, FILTER_KEYS_RESET_PAGE)
}

export function filtersAreEqual(a: VendorFilters, b: VendorFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyVendorFilters)
}

export function toVendorListQuery(filters: VendorFilters, debouncedSearch?: string) {
  const search = (debouncedSearch ?? filters.search).trim()
  return {
    page: filters.page,
    limit: Math.min(200, Math.max(1, filters.limit)),
    ...(search ? { search } : {}),
    ...(filters.vendorType ? { vendor_type: filters.vendorType } : {}),
    ...(filters.isActive === ''
      ? {}
      : { is_active: filters.isActive === 'true' }),
    sort_by: filters.sortBy,
    sort_order: filters.sortOrder,
  }
}
