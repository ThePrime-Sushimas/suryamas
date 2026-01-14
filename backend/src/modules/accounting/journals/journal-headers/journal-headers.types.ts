import { JournalType, JournalStatus, JournalLine } from '../shared/journal.types'

export interface JournalHeader {
  id: string
  company_id: string
  branch_id?: string
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
  tags?: Record<string, any>
  approval_flow_id?: string
}

export interface JournalHeaderWithLines extends JournalHeader {
  lines: JournalLine[]
}

export interface CreateJournalDto {
  // company_id comes from auth context, not client
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
  tags?: Record<string, any>
  lines: CreateJournalLineDto[]
}

export interface CreateJournalLineDto {
  line_number: number
  account_id: string
  description?: string
  debit_amount: number
  credit_amount: number
}

export interface UpdateJournalDto {
  journal_date?: string
  description?: string
  lines?: CreateJournalLineDto[]
}

export interface JournalFilter {
  company_id: string
  branch_id?: string
  journal_type?: JournalType
  status?: JournalStatus
  date_from?: string
  date_to?: string
  period?: string
  search?: string
  show_deleted?: boolean
}

export interface SortParams {
  field: 'journal_number' | 'journal_date' | 'journal_type' | 'status' | 'total_debit' | 'created_at' | 'updated_at'
  order: 'asc' | 'desc'
}
