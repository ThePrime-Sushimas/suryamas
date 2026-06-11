import {
  parsePositiveInt,
  parseEnum,
  parseString,
  serializeString,
  serializeNumber,
  mergeWithPageReset,
  type UrlFilterBase,
  type UrlFilterUtils,
} from '@/lib/urlFilters'

type MonthlyOpnameListStatus = 'DRAFT' | 'CONFIRMED' | 'REOPENED' | ''
const VALID_STATUSES = new Set<MonthlyOpnameListStatus>(['DRAFT', 'CONFIRMED', 'REOPENED', ''])

export type MonthlyOpnameFilters = UrlFilterBase & {
  status: MonthlyOpnameListStatus
  branch_id: string
  warehouse_id: string
  date_from: string
  date_to: string
  search: string
}

export const MONTHLY_OPNAME_FILTER_DEFAULTS: MonthlyOpnameFilters = {
  page: 1,
  limit: 25,
  status: '',
  branch_id: '',
  warehouse_id: '',
  date_from: '',
  date_to: '',
  search: '',
}

export const monthlyOpnameFilterConfig: UrlFilterUtils<MonthlyOpnameFilters> = {
  defaults: MONTHLY_OPNAME_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    branch_id: parseString(sp.get('branch_id')),
    warehouse_id: parseString(sp.get('warehouse_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
    search: parseString(sp.get('search')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 25))
    s('status', serializeString(f.status))
    s('branch_id', serializeString(f.branch_id))
    s('warehouse_id', serializeString(f.warehouse_id))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, MONTHLY_OPNAME_FILTER_DEFAULTS, ['status', 'branch_id', 'warehouse_id', 'date_from', 'date_to', 'search']),
}
