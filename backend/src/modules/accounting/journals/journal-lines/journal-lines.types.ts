import { JournalType, JournalStatus } from '../shared/journal.types'

export interface JournalLine {
  id: string
  journal_header_id: string
  line_number: number
  account_id: string
  description?: string
  
  // Raw amounts from DB
  debit_amount: number
  credit_amount: number
  
  // Currency
  currency: string
  exchange_rate: number
  base_debit_amount: number
  base_credit_amount: number
  
  // Optional tracking
  cost_center_id?: string
  project_id?: string
  
  // Audit fields
  created_at: string
  updated_at?: string
}

export interface JournalLineWithDetails extends JournalLine {
  // Derived/computed fields (calculated in query)
  is_debit: boolean
  amount: number
  
  // Account info (joined)
  account_code: string
  account_name: string
  account_type: string
  
  // Journal info (joined)
  journal_number: string
  journal_date: string
  journal_type: JournalType
  journal_status: JournalStatus
  journal_description: string
  period: string
  
  // Posting state (derived from journal_status)
  is_reversed: boolean
  
  // Branch info (joined)
  branch_id?: string
  branch_name?: string
}

export interface JournalLineFilter {
  /** Injected from auth context, not from client */
  company_id: string
  branch_id?: string
  
  // Account filtering
  account_id?: string
  account_code?: string
  
  // Journal filtering
  journal_type?: JournalType
  journal_status?: JournalStatus | 'POSTED_ONLY'
  
  // Period filtering
  period_from?: string  // YYYY-MM
  period_to?: string
  date_from?: string    // YYYY-MM-DD
  date_to?: string
  
  // State filtering
  include_reversed?: boolean  // default: false
  show_deleted?: boolean      // default: false
  
  // Search
  search?: string
}

export interface JournalLineSortParams {
  field: 'journal_date' | 'journal_number' | 'line_number' | 'account_code' | 'amount' | 'created_at'
  order: 'asc' | 'desc'
}

export interface JournalLineAggregation {
  account_id: string
  account_code: string
  account_name: string
  total_debit: number
  total_credit: number
  balance: number
  line_count: number
}
