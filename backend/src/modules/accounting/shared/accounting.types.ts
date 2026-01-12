export interface AccountingEntity {
  id: string
  company_id: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export interface AccountingPurpose extends AccountingEntity {
  name: string
  description?: string
  is_active: boolean
}

export interface AccountingPurposeAccount extends AccountingEntity {
  purpose_id: string
  chart_account_id: string
  mapped_account_code?: string
  mapped_account_name?: string
}

export interface JournalHeader extends AccountingEntity {
  journal_number: string
  reference?: string
  description?: string
  transaction_date: string
  posting_date?: string
  branch_id: string
  purpose_id: string
  status: 'draft' | 'posted' | 'cancelled'
  total_debit: number
  total_credit: number
  source_type?: string
  source_id?: string
}

export interface JournalLine extends AccountingEntity {
  journal_header_id: string
  line_number: number
  chart_account_id: string
  description?: string
  debit_amount: number
  credit_amount: number
  reference?: string
}

export interface LedgerEntry extends AccountingEntity {
  journal_line_id: string
  chart_account_id: string
  purpose_id: string
  branch_id: string
  transaction_date: string
  posting_date: string
  debit_amount: number
  credit_amount: number
  balance: number
  description?: string
  reference?: string
}