import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type PrqStatus = 'DRAFT' | 'ACCEPTED' | 'RECEIVED' | 'CANCELLED' | ''
const VALID_STATUSES = new Set<PrqStatus>(['DRAFT', 'ACCEPTED', 'RECEIVED', 'CANCELLED', ''])

export type ProductionRequestFilters = UrlFilterBase & {
  status: PrqStatus
  requesting_branch_id: string
  fulfilling_branch_id: string
  date_from: string
  date_to: string
  search: string
}

export const PRODUCTION_REQUEST_FILTER_DEFAULTS: ProductionRequestFilters = {
  page: 1,
  limit: 25,
  status: '',
  requesting_branch_id: '',
  fulfilling_branch_id: '',
  date_from: '',
  date_to: '',
  search: '',
}

export const productionRequestFilterConfig: UrlFilterUtils<ProductionRequestFilters> = {
  defaults: PRODUCTION_REQUEST_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    requesting_branch_id: parseString(sp.get('requesting_branch_id')),
    fulfilling_branch_id: parseString(sp.get('fulfilling_branch_id')),
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
    s('requesting_branch_id', serializeString(f.requesting_branch_id))
    s('fulfilling_branch_id', serializeString(f.fulfilling_branch_id))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, PRODUCTION_REQUEST_FILTER_DEFAULTS, [
      'status', 'requesting_branch_id', 'fulfilling_branch_id', 'date_from', 'date_to', 'search',
    ]),
}
