export type JournalType = 
  | 'MANUAL' 
  | 'PURCHASE' 
  | 'SALES' 
  | 'PAYMENT' 
  | 'RECEIPT' 
  | 'ADJUSTMENT' 
  | 'OPENING' 
  | 'CLOSING'

export type JournalStatus = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'APPROVED' 
  | 'POSTED' 
  | 'REVERSED' 
  | 'REJECTED'

export type JournalAction =
  | 'CREATED' 
  | 'UPDATED' 
  | 'SUBMITTED' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'POSTED' 
  | 'REVERSED' 
  | 'DELETED'

export interface JournalLine {
  id?: string
  journal_header_id?: string
  line_number: number
  account_id: string
  description?: string
  debit_amount: number
  credit_amount: number
  currency?: string
  exchange_rate?: number
  base_debit_amount?: number
  base_credit_amount?: number
  cost_center_id?: string
  project_id?: string
  branch_id?: string  // For future: line-level branch tracking
  created_at?: string
}
