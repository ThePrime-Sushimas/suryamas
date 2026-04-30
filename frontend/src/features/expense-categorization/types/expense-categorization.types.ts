export interface ExpenseAutoRule {
  id: string
  company_id: string
  purpose_id: string
  pattern: string
  match_type: 'CONTAINS' | 'STARTS_WITH' | 'EXACT' | 'REGEX'
  priority: number
  is_active: boolean
  purpose_code?: string
  purpose_name?: string
  created_at: string
  updated_at: string
}

export interface UncategorizedStatement {
  id: string
  transaction_date: string
  description: string
  debit_amount: number
  reference_number: string | null
  purpose_id: string | null
  purpose_name: string | null
}

export interface CategorizeResult {
  categorized: number
  skipped: number
  details: Array<{ statement_id: string; purpose_id: string; purpose_name: string }>
}

export interface AccountingPurposeOption {
  id: string
  purpose_code: string
  purpose_name: string
  applied_to: string
}
