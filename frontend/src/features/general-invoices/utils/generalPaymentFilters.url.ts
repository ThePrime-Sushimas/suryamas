import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import type { GeneralPaymentStatus } from '../api/generalApi.api'

export interface GeneralPaymentFilters {
  page: number
  limit: number
  search: string
  status: GeneralPaymentStatus | ''
}

export const DEFAULT_GENERAL_PAYMENT_FILTERS: GeneralPaymentFilters = {
  page: 1,
  limit: 20,
  search: '',
  status: '',
}

const VALID_STATUS = new Set<GeneralPaymentStatus>([
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'PAID',
  'RECONCILED',
])

const FILTER_KEYS_RESET_PAGE: (keyof GeneralPaymentFilters)[] = ['search', 'status', 'limit']

export function parseGeneralPaymentFilters(searchParams: URLSearchParams): GeneralPaymentFilters {
  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_GENERAL_PAYMENT_FILTERS.page),
    limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_GENERAL_PAYMENT_FILTERS.limit, 100),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    status: parseEnum(searchParams.get('status'), VALID_STATUS, ''),
  }
}

export function stringifyGeneralPaymentFilters(filters: GeneralPaymentFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_GENERAL_PAYMENT_FILTERS

  const page = serializeNumber(filters.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(filters.limit, d.limit)
  if (limit) params.set('limit', limit)
  const search = serializeString(filters.search)
  if (search) params.set('search', search)
  if (filters.status) params.set('status', filters.status)

  return params
}

export function mergeGeneralPaymentFilters(
  current: GeneralPaymentFilters,
  patch: Partial<GeneralPaymentFilters>,
): GeneralPaymentFilters {
  return mergeWithPageReset(current, patch, DEFAULT_GENERAL_PAYMENT_FILTERS, FILTER_KEYS_RESET_PAGE)
}

export function filtersAreEqual(a: GeneralPaymentFilters, b: GeneralPaymentFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyGeneralPaymentFilters)
}

export function toGeneralPaymentListQuery(filters: GeneralPaymentFilters, debouncedSearch?: string) {
  const search = (debouncedSearch ?? filters.search).trim()
  return {
    page: filters.page,
    limit: Math.min(100, Math.max(1, filters.limit)),
    ...(search ? { search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }
}
