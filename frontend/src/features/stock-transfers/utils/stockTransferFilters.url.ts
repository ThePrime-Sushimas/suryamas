import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type TransferStatus = 'DRAFT' | 'CONFIRMED' | 'RETURNED' | 'CANCELLED' | ''
type TransferType = 'TRANSFER' | 'LOAN' | ''

const VALID_STATUSES = new Set<TransferStatus>(['DRAFT', 'CONFIRMED', 'RETURNED', 'CANCELLED', ''])
const VALID_TYPES = new Set<TransferType>(['TRANSFER', 'LOAN', ''])

export type StockTransferFilters = UrlFilterBase & {
  transfer_type: TransferType
  status: TransferStatus
  source_branch_id: string
  target_branch_id: string
  date_from: string
  date_to: string
  search: string
}

export const STOCK_TRANSFER_FILTER_DEFAULTS: StockTransferFilters = {
  page: 1,
  limit: 25,
  transfer_type: '',
  status: '',
  source_branch_id: '',
  target_branch_id: '',
  date_from: '',
  date_to: '',
  search: '',
}

export const stockTransferFilterConfig: UrlFilterUtils<StockTransferFilters> = {
  defaults: STOCK_TRANSFER_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    transfer_type: parseEnum(sp.get('transfer_type'), VALID_TYPES, ''),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    source_branch_id: parseString(sp.get('source_branch_id')),
    target_branch_id: parseString(sp.get('target_branch_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
    search: parseString(sp.get('search')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 25))
    s('transfer_type', serializeString(f.transfer_type))
    s('status', serializeString(f.status))
    s('source_branch_id', serializeString(f.source_branch_id))
    s('target_branch_id', serializeString(f.target_branch_id))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, STOCK_TRANSFER_FILTER_DEFAULTS, [
      'transfer_type', 'status', 'source_branch_id', 'target_branch_id', 'date_from', 'date_to', 'search',
    ]),
}
