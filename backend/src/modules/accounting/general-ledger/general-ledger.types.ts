export interface GeneralLedgerLine {
  line_id: string
  journal_header_id: string
  account_id: string
  account_code: string
  account_name: string
  journal_date: string
  journal_number: string
  journal_type: string
  source_module: string | null
  journal_description: string | null
  line_description: string | null
  reference_number: string | null
  reference_type: string | null
  reference_id: string | null
  debit_amount: number
  credit_amount: number
  net_amount: number
  running_balance: number
  branch_id: string | null
}

export interface GeneralLedgerAccountInfo {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  normal_balance: string
}

export interface GeneralLedgerFilter {
  account_ids: string[]
  date_from: string
  date_to: string
  branch_ids?: string[]
  search?: string
  page?: number
  limit?: number
}
