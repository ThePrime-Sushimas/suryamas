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

type DpoStatusFilter = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | ''
const VALID_STATUSES = new Set<DpoStatusFilter>(['DRAFT', 'CONFIRMED', 'CANCELLED', ''])

export type DpoFilters = UrlFilterBase & {
  status: DpoStatusFilter
  branch_id: string
  date_from: string
  date_to: string
}

export const DPO_FILTER_DEFAULTS: DpoFilters = {
  page: 1,
  limit: 25,
  status: '',
  branch_id: '',
  date_from: '',
  date_to: '',
}

export const dpoFilterConfig: UrlFilterUtils<DpoFilters> = {
  defaults: DPO_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    branch_id: parseString(sp.get('branch_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
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
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, DPO_FILTER_DEFAULTS, ['status', 'branch_id', 'date_from', 'date_to']),
}
