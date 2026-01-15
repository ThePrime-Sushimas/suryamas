import type { JournalType, JournalStatus, JournalLine, JournalLineWithDetails } from '../../shared/journal.types'

export interface JournalHeader {
  id: string
  company_id: string
  branch_id?: string
  branch_name?: string
  journal_number: string
  sequence_number: number
  journal_date: string
  period: string
  journal_type: JournalType
  source_module?: string
  reference_type?: string
  reference_id?: string
  reference_number?: string
  description: string
  total_debit: number
  total_credit: number
  currency: string
  exchange_rate: number
  status: JournalStatus
  is_reversed: boolean
  reversed_by?: string
  reversal_date?: string
  reversal_reason?: string
  submitted_at?: string
  submitted_by?: string
  approved_at?: string
  approved_by?: string
  rejected_at?: string
  rejected_by?: string
  rejection_reason?: string
  posted_at?: string
  posted_by?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

export interface JournalHeaderWithLines extends JournalHeader {
  lines: (JournalLine | JournalLineWithDetails)[]
  branch_name?: string
  created_by_name?: string
  approved_by_name?: string
  posted_by_name?: string
}

export interface CreateJournalDto {
  branch_id?: string
  journal_date: string
  journal_type: JournalType
  description: string
  currency?: string
  exchange_rate?: number
  reference_type?: string
  reference_id?: string
  reference_number?: string
  source_module?: string
  lines: JournalLine[]
}

export interface UpdateJournalDto {
  journal_date?: string
  description?: string
  lines?: JournalLine[]
}

export interface RejectJournalDto {
  rejection_reason: string
}

export interface ReverseJournalDto {
  reversal_reason: string
}

export interface JournalHeaderFilter {
  branch_id?: string
  journal_type?: JournalType
  status?: JournalStatus
  date_from?: string
  date_to?: string
  period?: string
  search?: string
  show_deleted?: boolean
}

export interface JournalHeaderListResponse {
  data: JournalHeader[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
