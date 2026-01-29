export type BankStatementImportStatus =
  | 'PENDING'
  | 'ANALYZED'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'

export interface BankStatementImport {
  idx?: number
  id: number
  company_id: string
  bank_account_id: number
  file_name: string
  file_size: number
  file_hash?: string
  mime_type?: string
  status: BankStatementImportStatus
  total_rows: number
  processed_rows: number
  failed_rows: number
  date_range_start?: string
  date_range_end?: string
  created_at: string
  updated_at: string
  error_message?: string
  error_details?: Record<string, unknown> | null
  job_id?: number | null
  analysis_data?: Record<string, unknown> | null
  created_by?: string
  deleted_at?: string | null
}

export interface BankStatementDuplicateRow {
  id: string
  transaction_date: string
  description: string
  debit: number
  credit: number
  balance: number
}

// Backend analysis format
export interface BankStatementAnalysis {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  date_range_start: string
  date_range_end: string
  preview: unknown[]
  duplicates?: BankStatementDuplicateRow[]
  column_mapping: Record<string, string>
  errors?: unknown[]
  warnings?: string[]
}

// Frontend stats format (matches backend analysis)
export interface BankStatementAnalysisStats {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  duplicate_rows: number
  new_rows: number
}

// Backend response format
export interface BankStatementAnalysisResult {
  import: BankStatementImport
  analysis: BankStatementAnalysis
  stats?: BankStatementAnalysisStats
  warnings?: string[]
  duplicates?: BankStatementDuplicateRow[]
}

export interface BankStatementImportFilters {
  status?: BankStatementImportStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
  search?: string
}

