import { JOURNAL_TYPES, JOURNAL_STATUS } from './journal.constants'

// Extract types from constants
export type JournalType = keyof typeof JOURNAL_TYPES
export type JournalStatus = keyof typeof JOURNAL_STATUS

// Base journal line interface
export interface JournalLine {
  id?: string
  line_number: number
  account_id: string
  description?: string
  debit_amount: number
  credit_amount: number
  currency?: string
  exchange_rate?: number
}

// Journal line with computed fields (from backend)
export interface JournalLineWithDetails extends JournalLine {
  id: string
  journal_header_id: string
  is_debit: boolean
  amount: number
  base_debit_amount: number
  base_credit_amount: number
  account_code: string
  account_name: string
  account_type: string
  journal_number: string
  journal_date: string
  journal_type: JournalType
  journal_status: JournalStatus
  journal_description: string
  period: string
  is_reversed: boolean
  created_at: string
}

// Balance calculation result
export interface JournalBalance {
  total_debit: number
  total_credit: number
  balance: number
  is_balanced: boolean
}
