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
  // Frontend alias fields for compatibility
  date_from?: string
  date_to?: string
  created_at: string
  updated_at: string
  error_message?: string
  error_details?: Record<string, unknown> | null
  job_id?: number | null
  // Analysis data stored in database
  analysis_data?: {
    preview?: BankStatementPreviewRow[]
    column_mapping?: Record<string, string>
    valid_rows?: number
    invalid_rows?: number
    warnings?: string[]
  } | null
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

// Backend response format - matches actual backend response
// Backend summary includes: import, summary (with preview), stats, etc.
export interface BankStatementAnalysisResult {
  import: BankStatementImport
  summary: {
    total_statements: number
    total_credit: number
    total_debit: number
    reconciled_count: number
    duplicate_count: number
    preview?: BankStatementPreviewRow[]
  }
  stats?: BankStatementAnalysisStats
  warnings?: string[]
  duplicates?: BankStatementDuplicateRow[]
}

// Preview row type (matches backend)
export interface BankStatementPreviewRow {
  row_number: number
  transaction_date: string
  transaction_time?: string
  description: string
  debit_amount: number
  credit_amount: number
  balance?: number
  reference_number?: string
  is_valid: boolean
  errors?: string[]
  warnings?: string[]
}

export interface BankStatementImportFilters {
  status?: BankStatementImportStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
  search?: string
}

