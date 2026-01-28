/**
 * Bank Statement Import Constants
 * Configuration values dan constants untuk module
 */

// File upload constraints
export const FILE_UPLOAD = {
  MAX_SIZE: 50 * 1024 * 1024, // 50MB in bytes
  ALLOWED_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ],
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls'],
  TEMP_DIR: '/tmp/uploads',
}

// Batch processing
export const BATCH_PROCESSING = {
  DEFAULT_BATCH_SIZE: 500,
  MAX_BATCH_SIZE: 2000,
}

// Duplicate detection
export const DUPLICATE_DETECTION = {
  MATCH_THRESHOLD: 80, // 80% match score
  MAX_DUPLICATE_CHECK: 1000,
}

// Import status transitions
export const IMPORT_STATUS = {
  PENDING: 'PENDING',
  ANALYZED: 'ANALYZED',
  IMPORTING: 'IMPORTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  COMPLETED_WITH_ERRORS: 'COMPLETED_WITH_ERRORS',
} as const

// Transaction types
export const TRANSACTION_TYPE = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER: 'TRANSFER',
  PAYMENT: 'PAYMENT',
  FEE: 'FEE',
  INTEREST: 'INTEREST',
  OTHER: 'OTHER',
} as const

// Excel column name variations
export const COLUMN_MAPPINGS = {
  transaction_date: ['tanggal', 'date', 'tgl', 'transaction_date', 'trx_date'],
  transaction_time: ['waktu', 'time', 'jam', 'transaction_time'],
  reference_number: ['referensi', 'reference', 'ref', 'no_ref', 'ref_number'],
  description: ['keterangan', 'description', 'desc', 'memo'],
  debit_amount: ['debit', 'debet', 'keluar', 'withdrawal'],
  credit_amount: ['kredit', 'credit', 'masuk', 'deposit'],
  balance: ['saldo', 'balance', 'bal'],
}

// Job configuration
export const JOB_CONFIG = {
  TYPE: 'BANK_STATEMENT_IMPORT',
  MODULE: 'bank_statements',
  PROGRESS_UPDATE_INTERVAL: 100,
}

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
}

// Date formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DD_MM_YYYY: 'DD/MM/YYYY',
  MM_DD_YYYY: 'MM/DD/YYYY',
}

// Error messages
export const ERROR_MESSAGES = {
  FILE_REQUIRED: 'File is required',
  INVALID_FILE_TYPE: 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed',
  FILE_TOO_LARGE: 'File size exceeds maximum allowed size (50MB)',
  MISSING_COLUMNS: 'Missing required columns in Excel file',
  INVALID_DATE_FORMAT: 'Invalid date format',
  INVALID_AMOUNT_FORMAT: 'Invalid amount format',
  NO_DATA_ROWS: 'No data rows found in Excel file',
  IMPORT_NOT_FOUND: 'Import not found',
  INVALID_STATUS: 'Invalid import status for this operation',
  DUPLICATE_FILE: 'File has already been imported',
  PROCESSING_IN_PROGRESS: 'Import is already being processed',
} as const

export type ImportStatus = typeof IMPORT_STATUS[keyof typeof IMPORT_STATUS]
export type TransactionType = typeof TRANSACTION_TYPE[keyof typeof TRANSACTION_TYPE]

