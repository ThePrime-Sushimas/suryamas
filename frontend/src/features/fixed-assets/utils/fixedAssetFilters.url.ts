import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type FixedAssetStatus = 'DRAFT' | 'ACTIVE' | 'MAINTENANCE' | 'DISPOSED' | ''
const VALID_STATUSES = new Set<FixedAssetStatus>(['DRAFT', 'ACTIVE', 'MAINTENANCE', 'DISPOSED', ''])

export type FixedAssetFilters = UrlFilterBase & {
  status: FixedAssetStatus
  category_id: string
  branch_id: string
  search: string
  date_from: string
  date_to: string
}

export const FIXED_ASSET_FILTER_DEFAULTS: FixedAssetFilters = {
  page: 1,
  limit: 25,
  status: '',
  category_id: '',
  branch_id: '',
  search: '',
  date_from: '',
  date_to: '',
}

export const fixedAssetFilterConfig: UrlFilterUtils<FixedAssetFilters> = {
  defaults: FIXED_ASSET_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    category_id: parseString(sp.get('category_id')),
    branch_id: parseString(sp.get('branch_id')),
    search: parseString(sp.get('search')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 25))
    s('status', serializeString(f.status))
    s('category_id', serializeString(f.category_id))
    s('branch_id', serializeString(f.branch_id))
    s('search', serializeString(f.search))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, FIXED_ASSET_FILTER_DEFAULTS, [
      'status', 'category_id', 'branch_id', 'search', 'date_from', 'date_to',
    ]),
}
