export type BankStatementImportStatus =
  | 'PENDING'
  | 'ANALYZED'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'

export interface BankStatementImport {
  id: string
  company_id: string
  bank_account_id: string
  file_name: string
  file_size: number
  file_hash?: string
  mime_type?: string
  status: BankStatementImportStatus
  total_rows: number
  imported_rows: number
  duplicate_rows: number
  invalid_rows: number
  date_from?: string
  date_to?: string
  created_at: string
  updated_at: string
}

export interface BankStatementDuplicateRow {
  id: string
  transaction_date: string
  description: string
  debit: number
  credit: number
  balance: number
}

export interface BankStatementAnalysisStats {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  duplicate_rows: number
  new_rows: number
}

export interface BankStatementAnalysisWarnings {
  has_future_dates: boolean
  has_old_data: boolean
  future_dates_count: number
  old_data_count: number
}

export interface BankStatementAnalysisResult {
  import: BankStatementImport
  stats: BankStatementAnalysisStats
  warnings: BankStatementAnalysisWarnings
  duplicates: BankStatementDuplicateRow[]
}

export interface BankStatementImportFilters {
  status?: BankStatementImportStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
  search?: string
}

