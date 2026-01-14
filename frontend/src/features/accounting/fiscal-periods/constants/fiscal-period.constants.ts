export const PERIOD_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export const FISCAL_PERIOD_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const

export const FISCAL_PERIOD_STATUS_LABELS = {
  OPEN: 'Open',
  CLOSED: 'Closed',
}

export const FISCAL_PERIOD_STATUS_COLORS = {
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-red-100 text-red-800',
}

export const DEFAULT_PAGE_SIZE = 10
export const MAX_BULK_DELETE = 50
