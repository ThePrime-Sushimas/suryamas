/**
 * Bank Statement Import Types
 * TypeScript interfaces untuk bank statement import module
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Bank Statement Import Status
 */
export type BankStatementImportStatus =
  | 'PENDING'      // Baru diupload, belum dianalisis
  | 'ANALYZED'     // Sudah dianalisis, siap confirm
  | 'IMPORTING'    // Sedang diproses (job running)
  | 'COMPLETED'    // Import selesai
  | 'FAILED'       // Import gagal
  | 'COMPLETED_WITH_ERRORS' // Import selesai dengan beberapa error

/**
 * Bank Statement Transaction Type
 */
export type BankStatementTransactionType =
  | 'DEPOSIT'      // Setoran masuk
  | 'WITHDRAWAL'   // Penarikan
  | 'TRANSFER'     // Transfer keluar
  | 'PAYMENT'      // Pembayaran
  | 'FEE'          // Biaya admin
  | 'INTEREST'     // Bunga
  | 'ADJUSTMENT'   // Penyesuaian
  | 'OTHER'        // Lainnya

// ============================================================================
// MAIN INTERFACES
// ============================================================================

/**
 * Bank Statement Record
 * Represents a single transaction dari bank statement
 */
export interface BankStatement {
  id: number
  company_id: string
  bank_account_id: number
  
  // Transaction details
  transaction_date: string              // YYYY-MM-DD
  transaction_time?: string             // HH:mm:ss
  reference_number?: string
  description?: string
  
  // Amount
  debit_amount: number                  // 0 jika kredit
  credit_amount: number                 // 0 jika debit
  balance?: number
  
  // Classification
  transaction_type?: BankStatementTransactionType
  payment_method_id?: number            // FK ke payment_methods (jika terkait)
  
  // Reconciliation status
  is_reconciled: boolean
  reconciled_at?: string
  reconciliation_id?: number
  
  // Import metadata
  source_file?: string
  import_id?: number                    // FK ke bank_statement_imports
  row_number?: number
  
  // Audit
  created_at: string
  updated_at: string
  deleted_at?: string
  created_by?: string
  updated_by?: string
  deleted_by?: string
}

/**
 * Bank Statement Import Record
 * Represents an import session
 */
export interface BankStatementImport {
  id: number
  company_id: string
  bank_account_id: number
  
  // File info
  file_name: string
  file_size?: number
  file_hash?: string                    // SHA-256 untuk duplicate detection
  
  // Status
  status: BankStatementImportStatus
  total_rows: number
  processed_rows: number
  failed_rows: number
  
  // Date range dari transactions
  date_range_start?: string
  date_range_end?: string
  
  // Job reference
  job_id?: number
  
  // Error tracking
  error_message?: string
  
  // Audit
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

/**
 * Bank Statement dengan details (join result)
 */
export interface BankStatementWithDetails extends BankStatement {
  bank_name?: string
  account_number?: string
  account_name?: string
  payment_method_code?: string
  payment_method_name?: string
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/**
 * DTO for creating a new import
 */
export interface CreateBankStatementImportDto {
  company_id: string
  bank_account_id: number
  file_name: string
  file_size?: number
  file_hash?: string
  created_by?: string
}

/**
 * DTO for updating import
 */
export interface UpdateBankStatementImportDto {
  status?: BankStatementImportStatus
  total_rows?: number
  processed_rows?: number
  failed_rows?: number
  date_range_start?: string
  date_range_end?: string
  error_message?: string
}

/**
 * DTO for creating bank statement records
 */
export interface CreateBankStatementDto {
  company_id: string
  bank_account_id: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description?: string
  debit_amount?: number
  credit_amount?: number
  balance?: number
  transaction_type?: BankStatementTransactionType
  source_file?: string
  import_id?: number
  row_number?: number
  created_by?: string
}

/**
 * DTO for confirming import
 */
export interface ConfirmImportDto {
  skip_duplicates?: boolean
  dry_run?: boolean
}

// ============================================================================
// FILTER & QUERY INTERFACES
// ============================================================================

/**
 * Filter parameters for listing imports
 */
export interface BankStatementImportFilterParams {
  bank_account_id?: number
  status?: BankStatementImportStatus
  date_from?: string
  date_to?: string
  search?: string
}

/**
 * Filter parameters for listing statements
 */
export interface BankStatementFilterParams {
  bank_account_id?: number
  transaction_date_from?: string
  transaction_date_to?: string
  is_reconciled?: boolean
  transaction_type?: BankStatementTransactionType
  payment_method_id?: number
  import_id?: number
  search?: string
}

// ============================================================================
// ANALYSIS INTERFACES
// ============================================================================

/**
 * Analysis result dari uploaded file
 */
export interface BankStatementAnalysis {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  date_range_start: string
  date_range_end: string
  preview: BankStatementPreviewRow[]
  duplicates?: BankStatementDuplicate[]
  column_mapping: BankStatementColumnMapping
  errors?: any[]
  warnings?: string[]
}

/**
 * Preview row for file analysis
 */
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

/**
 * Duplicate detection result
 */
export interface BankStatementDuplicate {
  reference_number?: string
  transaction_date: string
  debit_amount: number
  credit_amount: number
  existing_import_id: number
  existing_statement_id: number
  row_numbers: number[]
}

/**
 * Column mapping dari Excel ke database
 */
export interface BankStatementColumnMapping {
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: string
  credit_amount: string
  balance?: string
  transaction_type?: string
}

// ============================================================================
// IMPORT RESULT INTERFACES
// ============================================================================

/**
 * Result dari upload + analyze
 */
export interface UploadAnalysisResult {
  import: BankStatementImport
  analysis: BankStatementAnalysis
}

/**
 * Result dari confirm import
 */
export interface ConfirmImportResult {
  import: BankStatementImport
  job_id: string
}

/**
 * Result dari processing
 */
export interface ImportProcessingResult {
  import_id: number
  total_rows: number
  processed_rows: number
  failed_rows: number
  duplicates_skipped: number
  duration_ms: number
}

// ============================================================================
// PAGINATION INTERFACES
// ============================================================================

/**
 * Paginated imports response
 */
export interface PaginatedImportsResponse {
  data: BankStatementImport[]
  total: number
  page: number
  limit: number
}

/**
 * Paginated statements response
 */
export interface PaginatedStatementsResponse {
  data: BankStatement[]
  total: number
  page: number
  limit: number
}

// ============================================================================
// JOB METADATA INTERFACES
// ============================================================================

/**
 * Job metadata untuk import processing
 */
export interface BankStatementImportJobMetadata {
  type: 'import'
  module: 'bank_statements'
  importId: number
  bankAccountId: number
  companyId: string
  skipDuplicates: boolean
  dryRun: boolean
  totalRows: number
}

// ============================================================================
// VALIDATION INTERFACES
// ============================================================================

/**
 * Validation result untuk file analysis
 */
export interface FileValidationResult {
  is_valid: boolean
  errors: string[]
  warnings: string[]
  column_mapping: Record<string, string>
  detected_format?: string
}

// ============================================================================
// PARSING INTERFACES
// ============================================================================

/**
 * Parsed bank statement row from Excel/CSV
 */
export interface ParsedBankStatementRow {
  row_number: number
  transaction_date: string | Date
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: number | string
  credit_amount: number | string
  balance?: number | string
  transaction_type?: string
  is_valid: boolean
  errors?: string[]
}

/**
 * Excel column mapping configuration
 */
export interface ExcelColumnMapping {
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: string
  credit_amount: string
  balance?: string
  transaction_type?: string
}