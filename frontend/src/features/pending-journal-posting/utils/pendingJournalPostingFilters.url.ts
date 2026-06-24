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
import type { PendingModule } from '../api/pendingJournalPosting.api'

type ModuleFilter = PendingModule | ''

const VALID_MODULES = new Set<ModuleFilter>([
  '',
  'purchase_invoices',
  'general_invoices',
  'ap_payments',
  'asset_disposals',
  'stock_adjustments',
  'stock_transfers',
  'production_orders',
  'marketplace_po',
])

export type PendingJournalFilters = UrlFilterBase & {
  module: ModuleFilter
  branch_id: string
  date_from: string
  date_to: string
}

export const PENDING_JOURNAL_FILTER_DEFAULTS: PendingJournalFilters = {
  page: 1,
  limit: 50,
  module: '',
  branch_id: '',
  date_from: '',
  date_to: '',
}

export const pendingJournalFilterConfig: UrlFilterUtils<PendingJournalFilters> = {
  defaults: PENDING_JOURNAL_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 50, 100),
    module: parseEnum(sp.get('module'), VALID_MODULES, ''),
    branch_id: parseString(sp.get('branch_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 50))
    s('module', serializeString(f.module))
    s('branch_id', serializeString(f.branch_id))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, PENDING_JOURNAL_FILTER_DEFAULTS, ['module', 'branch_id', 'date_from', 'date_to']),
}
