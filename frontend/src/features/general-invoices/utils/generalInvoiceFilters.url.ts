import {
  filtersEqualFromStringify,
  mergeWithPageReset,
  parseEnum,
  parsePositiveInt,
  parseString,
  serializeNumber,
  serializeString,
} from '@/lib/urlFilters'
import type { ExpenseType, GeneralInvoiceStatus } from '../api/generalApi.api'

export interface GeneralInvoiceFilters {
  page: number
  limit: number
  search: string
  status: GeneralInvoiceStatus | ''
  expenseType: ExpenseType | ''
  overdue: boolean
}

export const DEFAULT_GENERAL_INVOICE_FILTERS: GeneralInvoiceFilters = {
  page: 1,
  limit: 20,
  search: '',
  status: '',
  expenseType: '',
  overdue: false,
}

const VALID_STATUS = new Set<GeneralInvoiceStatus>(['DRAFT', 'POSTED', 'CANCELLED'])
const VALID_EXPENSE = new Set<ExpenseType>([
  'UTILITY',
  'RENT',
  'SALARY_SUPPORT',
  'SUBSCRIPTION',
  'MAINTENANCE',
  'OTHER',
])

const FILTER_KEYS_RESET_PAGE: (keyof GeneralInvoiceFilters)[] = [
  'search',
  'status',
  'expenseType',
  'overdue',
  'limit',
]

export function parseGeneralInvoiceFilters(searchParams: URLSearchParams): GeneralInvoiceFilters {
  const overdueRaw = searchParams.get('overdue')
  return {
    page: parsePositiveInt(searchParams.get('page'), DEFAULT_GENERAL_INVOICE_FILTERS.page),
    limit: parsePositiveInt(searchParams.get('limit'), DEFAULT_GENERAL_INVOICE_FILTERS.limit, 100),
    search: parseString(searchParams.get('search') ?? searchParams.get('q')),
    status: parseEnum(searchParams.get('status'), VALID_STATUS, ''),
    expenseType: parseEnum(searchParams.get('expense_type'), VALID_EXPENSE, ''),
    overdue: overdueRaw === '1' || overdueRaw === 'true',
  }
}

export function stringifyGeneralInvoiceFilters(filters: GeneralInvoiceFilters): URLSearchParams {
  const params = new URLSearchParams()
  const d = DEFAULT_GENERAL_INVOICE_FILTERS

  const page = serializeNumber(filters.page, d.page)
  if (page) params.set('page', page)
  const limit = serializeNumber(filters.limit, d.limit)
  if (limit) params.set('limit', limit)
  const search = serializeString(filters.search)
  if (search) params.set('search', search)
  if (filters.status) params.set('status', filters.status)
  if (filters.expenseType) params.set('expense_type', filters.expenseType)
  if (filters.overdue) params.set('overdue', '1')

  return params
}

export function mergeGeneralInvoiceFilters(
  current: GeneralInvoiceFilters,
  patch: Partial<GeneralInvoiceFilters>,
): GeneralInvoiceFilters {
  return mergeWithPageReset(current, patch, DEFAULT_GENERAL_INVOICE_FILTERS, FILTER_KEYS_RESET_PAGE)
}

export function filtersAreEqual(a: GeneralInvoiceFilters, b: GeneralInvoiceFilters): boolean {
  return filtersEqualFromStringify(a, b, stringifyGeneralInvoiceFilters)
}

export function toGeneralInvoiceListQuery(
  filters: GeneralInvoiceFilters,
  debouncedSearch?: string,
) {
  const search = (debouncedSearch ?? filters.search).trim()
  return {
    page: filters.page,
    limit: Math.min(100, Math.max(1, filters.limit)),
    ...(search ? { search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.expenseType ? { expense_type: filters.expenseType } : {}),
    ...(filters.overdue ? { overdue: true as const } : {}),
  }
}
