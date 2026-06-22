import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  serializeNumber,
  serializeString,
  type UrlFilterBase,
  type UrlFilterUtils,
} from '@/lib/urlFilters'
import type { AmortizationStatus } from '../api/generalApi.api'

export type AmortizationFilters = UrlFilterBase & {
  status: AmortizationStatus | ''
}

// page/limit are required by UrlFilterBase generic constraint but not used by
// the API endpoint (this page fetches all amortizations without pagination).
// They exist solely to satisfy the useUrlFilters type contract.
export const DEFAULT_AMORTIZATION_FILTERS: AmortizationFilters = {
  page: 1,
  limit: 50,
  status: 'ACTIVE',
}

const VALID_STATUS = new Set<AmortizationStatus | ''>(['ACTIVE', 'COMPLETED', 'CANCELLED', ''])

const FILTER_KEYS_RESET: (keyof AmortizationFilters)[] = ['status']

export function parseAmortizationFilters(sp: URLSearchParams): AmortizationFilters {
  return {
    page: parsePositiveInt(sp.get('page'), DEFAULT_AMORTIZATION_FILTERS.page),
    limit: parsePositiveInt(sp.get('limit'), DEFAULT_AMORTIZATION_FILTERS.limit, 100),
    status: parseEnum(sp.get('status'), VALID_STATUS, DEFAULT_AMORTIZATION_FILTERS.status),
  }
}

export function stringifyAmortizationFilters(f: AmortizationFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_AMORTIZATION_FILTERS

  const page = serializeNumber(f.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(f.limit, d.limit)
  if (limit) params.set('limit', limit)
  // 'ACTIVE' is default — omit from URL when default
  const status = serializeString(f.status === d.status ? '' : f.status)
  if (status) params.set('status', status)

  return params
}

export function mergeAmortizationFilters(
  current: AmortizationFilters,
  patch: Partial<AmortizationFilters>,
): AmortizationFilters {
  return mergeWithPageReset(current, patch, DEFAULT_AMORTIZATION_FILTERS, FILTER_KEYS_RESET)
}

export function filtersAreEqual(a: AmortizationFilters, b: AmortizationFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyAmortizationFilters)
}

export const amortizationFilterUtils: UrlFilterUtils<AmortizationFilters> = {
  defaults: DEFAULT_AMORTIZATION_FILTERS,
  parse: parseAmortizationFilters,
  stringify: stringifyAmortizationFilters,
  merge: mergeAmortizationFilters,
  equals: filtersAreEqual,
}
