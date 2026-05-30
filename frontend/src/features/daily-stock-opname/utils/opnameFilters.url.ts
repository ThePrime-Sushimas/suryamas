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

type OpnameListStatus = 'DRAFT' | 'CONFIRMED' | 'FLAGGED' | 'MISSED' | ''
const VALID_STATUSES = new Set<OpnameListStatus>(['DRAFT', 'CONFIRMED', 'FLAGGED', 'MISSED', ''])

export type OpnameFilters = UrlFilterBase & {
  status: OpnameListStatus
  branch_id: string
  date_from: string
  date_to: string
  search: string
}

export const OPNAME_FILTER_DEFAULTS: OpnameFilters = {
  page: 1,
  limit: 25,
  status: '',
  branch_id: '',
  date_from: '',
  date_to: '',
  search: '',
}

export const opnameFilterConfig: UrlFilterUtils<OpnameFilters> = {
  defaults: OPNAME_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    branch_id: parseString(sp.get('branch_id')),
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
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, OPNAME_FILTER_DEFAULTS, ['status', 'branch_id', 'date_from', 'date_to', 'search']),
}
