export interface ExpenseAutoRule {
  id: string
  company_id: string
  purpose_id: string
  pattern: string
  match_type: 'CONTAINS' | 'STARTS_WITH' | 'EXACT' | 'REGEX'
  priority: number
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  purpose_code?: string
  purpose_name?: string
}

export interface CreateRuleDto {
  purpose_id: string
  pattern: string
  match_type?: 'CONTAINS' | 'STARTS_WITH' | 'EXACT' | 'REGEX'
  priority?: number
}

export interface UpdateRuleDto {
  purpose_id?: string
  pattern?: string
  match_type?: 'CONTAINS' | 'STARTS_WITH' | 'EXACT' | 'REGEX'
  priority?: number
  is_active?: boolean
}

export interface CategorizeResult {
  categorized: number
  skipped: number
  details: Array<{ statement_id: string; purpose_id: string; purpose_name: string }>
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
