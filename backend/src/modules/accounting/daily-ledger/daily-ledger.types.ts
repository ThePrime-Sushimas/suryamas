export interface DailyLedgerMovement {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_code: string | null
  parent_account_name: string | null
  journal_date: string
  debit_amount: number
  credit_amount: number
}

export interface DailyLedgerOpening {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_code: string | null
  parent_account_name: string | null
  opening_debit: number
  opening_credit: number
}

export interface DailyLedgerResponse {
  movements: DailyLedgerMovement[]
  openings: DailyLedgerOpening[]
}

export interface DailyLedgerFilter {
  date_from: string
  date_to: string
  branch_ids?: string[]
  account_types?: string[]
}
