import type { JournalLineWithDetails } from '../../shared/journal.types'
import type { JournalType, JournalStatus } from '../../shared/journal.types'

export interface JournalLineFilter {
  branch_id?: string
  account_id?: string
  journal_type?: JournalType
  journal_status?: JournalStatus | 'POSTED_ONLY'
  period_from?: string
  period_to?: string
  date_from?: string
  date_to?: string
  include_reversed?: boolean
  show_deleted?: boolean
  search?: string
}

export interface JournalLineListResponse {
  data: JournalLineWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface JournalLinesByAccountResponse {
  lines: JournalLineWithDetails[]
  summary: {
    total_debit: number
    total_credit: number
    balance: number
    line_count: number
  }
}

export type { JournalLineWithDetails }
