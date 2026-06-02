import {
  parsePositiveInt, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

export type WipFilters = UrlFilterBase & {
  search: string
  position_filter: string
}

export const WIP_FILTER_DEFAULTS: WipFilters = {
  page: 1,
  limit: 50,
  search: '',
  position_filter: '',
}

export const wipFilterConfig: UrlFilterUtils<WipFilters> = {
  defaults: WIP_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 50, 100),
    search: parseString(sp.get('search')),
    position_filter: parseString(sp.get('position_filter')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 50))
    s('search', serializeString(f.search))
    s('position_filter', serializeString(f.position_filter))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, WIP_FILTER_DEFAULTS, ['position_filter', 'search']),
}
