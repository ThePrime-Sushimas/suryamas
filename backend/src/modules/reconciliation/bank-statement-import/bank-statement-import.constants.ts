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
    'text/csv', // .csv
    'application/csv', // .csv
  ],
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls', '.csv'],
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

// ============================================================================
// BANK CSV FORMAT CONFIGURATIONS
// ============================================================================

/**
 * Enum untuk tipe format CSV bank
 */
export const BANK_CSV_FORMAT = {
  BCA_PERSONAL: 'BCA_PERSONAL',
  BCA_BUSINESS: 'BCA_BUSINESS',
  BANK_MANDIRI: 'BANK_MANDIRI',
  UNKNOWN: 'UNKNOWN',
} as const

export type BankCSVFormat = typeof BANK_CSV_FORMAT[keyof typeof BANK_CSV_FORMAT]

/**
 * Konfigurasi format CSV per bank
 */
export const BANK_CSV_FORMATS: Record<BankCSVFormat, {
  name: string
  headerRowIndex: number
  dataStartRowIndex: number
  hasQuotes: boolean
  delimiter: string
  multiLineTransaction: boolean
  pendingIndicator: string
  dateFormat: string
  columnCount: number
  description: string
}> = {
  [BANK_CSV_FORMAT.BCA_PERSONAL]: {
    name: 'BCA Personal',
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    hasQuotes: false,
    delimiter: ',',
    multiLineTransaction: false,
    pendingIndicator: 'PEND',
    dateFormat: 'DD/MM/YYYY',
    columnCount: 7,
    description: 'Format CSV statement BCA personal (single line per transaction)',
  },
  [BANK_CSV_FORMAT.BCA_BUSINESS]: {
    name: 'BCA Bisnis',
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    hasQuotes: true,
    delimiter: ',',
    multiLineTransaction: false,
    pendingIndicator: 'PEND',
    dateFormat: 'DD/MM/YYYY',
    columnCount: 4,
    description: 'Format CSV statement BCA bisnis (dengan quotes)',
  },
  [BANK_CSV_FORMAT.BANK_MANDIRI]: {
    name: 'Bank Mandiri',
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    hasQuotes: false,
    delimiter: ' ',
    multiLineTransaction: true,
    pendingIndicator: 'PEND',
    dateFormat: 'DD/MM/YYYY',
    columnCount: 6,
    description: 'Format statement Bank Mandiri (multi-line per transaction)',
  },
  [BANK_CSV_FORMAT.UNKNOWN]: {
    name: 'Unknown',
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    hasQuotes: false,
    delimiter: ',',
    multiLineTransaction: false,
    pendingIndicator: 'PEND',
    dateFormat: 'DD/MM/YYYY',
    columnCount: 0,
    description: 'Format tidak dikenali',
  },
}

/**
 * Header patterns untuk detect format bank
 */
export const BANK_HEADER_PATTERNS: Record<BankCSVFormat, string[]> = {
  [BANK_CSV_FORMAT.BCA_PERSONAL]: [
    'date', 'description', 'branch', 'amount', 'balance',
    'tanggal', 'keterangan', 'cabang', 'jumlah', 'saldo'
  ],
  [BANK_CSV_FORMAT.BCA_BUSINESS]: [
    'tanggal transaksi', 'keterangan', 'cabang', 'jumlah',
    'date', 'description', 'branch', 'amount'
  ],
  [BANK_CSV_FORMAT.BANK_MANDIRI]: [
    'account no', 'date', 'val. date', 'transaction code',
    'description', 'description', 'reference no', 'debit', 'credit',
    'postdate', 'remarks', 'additionaldesc', 'credit amount', 'debit amount', 'close balance'
  ],
  [BANK_CSV_FORMAT.UNKNOWN]: [],
}

/**
 * Column index mapping for each format
 * Handle cases where header doesn't match data columns
 */
export const BANK_COLUMN_INDEX_MAPPING: Record<BankCSVFormat, {
  transaction_date: number
  description?: number
  branch?: number
  debit_amount?: number
  credit_amount?: number
  balance?: number
  cr_db_indicator?: number
  account_no?: number
  transaction_code?: number
  reference_no?: number
}> = {
  [BANK_CSV_FORMAT.BCA_PERSONAL]: {
    transaction_date: 0,  // Date: '02/01/2026
    description: 1,       // Description
    branch: 2,            // Branch: '0000
    debit_amount: 3,      // Amount: 72100000.00
    cr_db_indicator: 4,   // CR/DB indicator
    balance: 5,           // Balance
  },
  [BANK_CSV_FORMAT.BCA_BUSINESS]: {
    transaction_date: 0,  // Date: 01/01/2026
    description: 1,       // Description
    branch: 2,            // Branch: 0000
    debit_amount: 3,      // Amount: "287,490.00 DB" or "799,700.00 CR"
    balance: 4,           // Balance (optional)
  },
  [BANK_CSV_FORMAT.BANK_MANDIRI]: {
    account_no: 0,        // Account No
    transaction_date: 1,  // Date
    description: 4,       // Description column (index 4 = 5th column "Description")
    branch: 2,            // Transaction Code column as branch
    debit_amount: 7,      // Debit column
    credit_amount: 8,     // Credit column
    balance: 5,           // Close balance
    transaction_code: 3,  // Transaction Code
    reference_no: 6,      // Reference No.
  },
  [BANK_CSV_FORMAT.UNKNOWN]: {
    transaction_date: 0,
    description: 1,
    branch: 2,
    debit_amount: 3,
    credit_amount: 4,
    balance: 5,
  },
}

/**
 * Amount patterns untuk extract amount dari berbagai format
 */
export const AMOUNT_PATTERNS = {
  // Pattern untuk "123,456.00 DB" atau "123,456.00 CR"
  WITH_INDICATOR: /^([\d,]+\.?\d*)\s*(DB|CR|DR|KREDIT|DEBIT)?$/i,
  
  // Pattern untuk embedded amount di description
  // E.g., "TRSF E-BANKING DB 0101/FTSCY/WS95271 72100000.00MICHAEL"
  EMBEDDED_AMOUNT: /(\d{8,}(?:\.\d{2})?)/,
  
  // Pattern untuk Indonesian number format dengan dots dan commas
  IDR_FORMAT: /[\d,]+\.?\d*/g,
  
  // Pattern untuk Mandiri format ".00" atau "453,684.00"
  MANDIRI_AMOUNT: /\.?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
  
  // Pattern untuk extract amount dari text
  EXTRACT_AMOUNT: /([\d,]+\.?\d*)/,
}

/**
 * Special parsing configurations per format
 */
export const BANK_PARSING_CONFIG: Record<BankCSVFormat, {
  skipLeadingQuote: boolean
  quoteChar: string
  hasEmptyColumns: boolean
  emptyColumnIndices: number[]
  trimWhitespace: boolean
  descriptionMaxLength: number
  dateFormat: string
}> = {
  [BANK_CSV_FORMAT.BCA_PERSONAL]: {
    skipLeadingQuote: true,
    quoteChar: "'",
    hasEmptyColumns: true,
    emptyColumnIndices: [4], // Column 4 is empty in header (index 4 = 5th column)
    trimWhitespace: true,
    descriptionMaxLength: 1000,
    dateFormat: 'DD/MM/YYYY',
  },
  [BANK_CSV_FORMAT.BCA_BUSINESS]: {
    skipLeadingQuote: false,
    quoteChar: '"',
    hasEmptyColumns: false,
    emptyColumnIndices: [],
    trimWhitespace: true,
    descriptionMaxLength: 1000,
    dateFormat: 'DD/MM/YYYY',
  },
  [BANK_CSV_FORMAT.BANK_MANDIRI]: {
    skipLeadingQuote: false,
    quoteChar: '"',
    hasEmptyColumns: true,
    emptyColumnIndices: [6], // Reference No. can be empty
    trimWhitespace: true,
    descriptionMaxLength: 1000,
    dateFormat: 'DD/MM/YY',
  },
  [BANK_CSV_FORMAT.UNKNOWN]: {
    skipLeadingQuote: false,
    quoteChar: '"',
    hasEmptyColumns: false,
    emptyColumnIndices: [],
    trimWhitespace: true,
    descriptionMaxLength: 500,
    dateFormat: 'DD/MM/YYYY',
  },
}

/**
 * PENDING transaction indicator
 */
export const PENDING_TRANSACTION = {
  INDICATOR: 'PEND',
  DESCRIPTION_PREFIX: 'PEND',
  TRANSACTION_TYPE: 'PENDING' as const,
}

// Error messages
export const ERROR_MESSAGES = {
  FILE_REQUIRED: 'File is required',
  INVALID_FILE_TYPE: 'Invalid file type. Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed',
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