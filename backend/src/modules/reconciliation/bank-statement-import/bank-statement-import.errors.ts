/**
 * Bank Statement Import Errors
 * Error definitions untuk bank statement import module
 * 
 * Design Principles:
 * - Bilingual support (Indonesian + English)
 * - Actionable error messages dengan guidance
 * - Consistent error code format
 */

import { AppError, ValidationError, NotFoundError, ConflictError } from '../../../utils/error-handler.util'

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

export class BankStatementImportError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: string,
    context?: any
  ) {
    super(message, statusCode, code, context)
    this.name = 'BankStatementImportError'
  }
}

// ============================================================================
// ERROR CODES & MESSAGES (Bilingual Support)
// ============================================================================

export const BankStatementImportErrors = {
  // ========================================================================
  // FILE UPLOAD ERRORS - Kesalahan Upload File
  // ========================================================================
  
  NO_FILE_UPLOADED: () => 
    new BankStatementImportError(
      'No file uploaded',
      400, 
      'BS_NO_FILE_UPLOADED',
      { userMessage: 'Silakan pilih file terlebih dahulu untuk diupload.' }
    ),
  
  FILE_TOO_LARGE: (maxSizeMB: number) => 
    new BankStatementImportError(
      `File too large. Maximum size is ${maxSizeMB}MB`,
      400, 
      'BS_FILE_TOO_LARGE',
      { maxSizeMB, userMessage: `Ukuran file terlalu besar. Maksimal ukuran file adalah ${maxSizeMB}MB. Silakan kompres file atau gunakan file yang lebih kecil.` }
    ),
  
  INVALID_FILE_TYPE: () => 
    new BankStatementImportError(
      'Invalid file type. Please upload Excel file (.xlsx, .xls) or CSV (.csv)',
      400, 
      'BS_INVALID_FILE_TYPE',
      { allowedTypes: ['.xlsx', '.xls', '.csv'], userMessage: 'Format file tidak didukung. Gunakan file Excel (.xlsx, .xls) atau CSV (.csv).' }
    ),
  
  INVALID_EXCEL_FORMAT: () => 
    new BankStatementImportError(
      'Invalid Excel format. Could not read the file',
      400, 
      'BS_INVALID_EXCEL_FORMAT',
      { userMessage: 'Format file Excel tidak valid. Pastikan file dapat dibuka di Microsoft Excel dan tidak dalam mode proteksi.' }
    ),
  
  EMPTY_FILE: () => 
    new BankStatementImportError(
      'File is empty or contains no valid data',
      400, 
      'BS_EMPTY_FILE',
      { userMessage: 'File kosong atau tidak berisi data yang valid. Silakan cek kembali file Anda.' }
    ),
  
  CORRUPTED_FILE: () => 
    new BankStatementImportError(
      'File appears to be corrupted or damaged',
      400, 
      'BS_CORRUPTED_FILE',
      { userMessage: 'File tampaknya rusak atau tidak dapat dibaca. Silakan coba file yang lain atau unduh ulang file tersebut.' }
    ),

  // ========================================================================
  // DATA VALIDATION ERRORS - Kesalahan Validasi Data
  // ========================================================================
  
  MISSING_REQUIRED_COLUMNS: (columns: string[]) => 
    new ValidationError(
      `Missing required columns: ${columns.join(', ')}`,
      { requiredColumns: columns, userMessage: `Kolom berikut wajib ada pada file: ${columns.join(', ')}. Silakan cek format template.` }
    ),
  
  INVALID_DATE_FORMAT: (column: string, examples: string[]) => 
    new ValidationError(
      `Invalid date format in column: ${column}. Use formats like: ${examples.join(', ')}`,
      { column, validFormats: examples, userMessage: `Format tanggal di kolom "${column}" tidak valid. Gunakan format: ${examples.join(', ')}.` }
    ),
  
  INVALID_AMOUNT_FORMAT: (column: string, rowNumber?: number) => 
    new ValidationError(
      `Invalid amount format in column: ${column}${rowNumber ? ` at row ${rowNumber}` : ''}. Use numeric values without currency symbols`,
      { column, rowNumber, userMessage: `Format jumlah di kolom "${column}" tidak valid${rowNumber ? ` (baris ${rowNumber})` : ''}. Gunakan angka tanpa simbol mata uang.` }
    ),
  
  INVALID_ROW: (rowNumber: number, errors: string[]) => 
    new ValidationError(
      `Invalid row ${rowNumber}: ${errors.join('; ')}`,
      { rowNumber, errors, userMessage: `Baris ${rowNumber} memiliki kesalahan: ${errors.join('; ')}. Silakan perbaiki data tersebut.` }
    ),
  
  INVALID_FILE: (reason: string) => 
    new ValidationError(
      `Invalid file: ${reason}`,
      { reason, userMessage: `File tidak valid: ${reason}` }
    ),
  
  INVALID_TRANSACTION_DATE_RANGE: () => 
    new ValidationError(
      'Transaction date range is invalid or out of reasonable bounds',
      { userMessage: 'Rentang tanggal transaksi tidak valid. Pastikan tanggal tidak terlalu jauh di masa depan atau masa lalu.' }
    ),
  
  TOO_MANY_INVALID_ROWS: (invalidCount: number, totalRows: number) => 
    new ValidationError(
      `Too many invalid rows: ${invalidCount} out of ${totalRows} (${Math.round(invalidCount/totalRows*100)}%)`,
      { invalidCount, totalRows, percentage: Math.round(invalidCount/totalRows*100), userMessage: `Terlalu banyak baris yang tidak valid (${invalidCount} dari ${totalRows}). Silakan cek dan perbaiki data Anda.` }
    ),

  // ========================================================================
  // IMPORT STATUS ERRORS - Kesalahan Status Import
  // ========================================================================
  
  IMPORT_NOT_FOUND: (id: number) => 
    new NotFoundError(
      `Bank statement import with ID ${id} not found`,
      { id, userMessage: `Data import dengan ID ${id} tidak ditemukan. Kemungkinan data sudah dihapus.` }
    ),
  
  INVALID_STATUS: (status: string, validStatuses: string[]) => 
    new ValidationError(
      `Invalid import status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`,
      { status, validStatuses, userMessage: `Status import tidak valid: ${status}` }
    ),
  
  INVALID_STATUS_TRANSITION: (currentStatus: string, newStatus: string) => 
    new BankStatementImportError(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      400, 
      'BS_INVALID_STATUS_TRANSITION',
      { currentStatus, newStatus, userMessage: `Tidak dapat mengubah status dari "${currentStatus}" ke "${newStatus}". Silakan refresh halaman dan coba lagi.` }
    ),
  
  CANNOT_IMPORT_ANALYZED: () => 
    new BankStatementImportError(
      'Import is already in analyzed state',
      400, 
      'BS_ALREADY_ANALYZED',
      { userMessage: 'Data ini sudah dalam tahap analisis. Silakan refresh halaman.' }
    ),
  
  CANNOT_CANCEL_COMPLETED: () => 
    new BankStatementImportError(
      'Cannot cancel a completed import',
      400, 
      'BS_CANNOT_CANCEL_COMPLETED',
      { userMessage: 'Tidak dapat membatalkan import yang sudah selesai.' }
    ),

  // ========================================================================
  // DUPLICATE ERRORS - Kesalahan Duplikat
  // ========================================================================
  
  DUPLICATE_FILE: (fileName: string) => 
    new ConflictError(
      `File "${fileName}" has already been uploaded`,
      { fileName, userMessage: `File "${fileName}" sudah pernah diupload sebelumnya. Silakan gunakan file yang berbeda atau hapus import sebelumnya.` }
    ),
  
  DUPLICATE_TRANSACTION: (reference: string, date: string, count: number) => 
    new ConflictError(
      `Duplicate transaction detected: ${reference} on ${date}`,
      { reference, date, count, userMessage: `Terdeteksi ${count} transaksi duplikat dengan referensi "${reference}" pada tanggal ${date}. Transaksi akan dilewati saat import.` }
    ),
  
  TOO_MANY_DUPLICATES: (duplicateCount: number, totalRows: number) => 
    new ConflictError(
      `Too many duplicate transactions: ${duplicateCount} out of ${totalRows}`,
      { duplicateCount, totalRows, userMessage: `Terlalu banyak duplikat (${duplicateCount} dari ${totalRows}). Silakan cek data Anda atau centang opsi "Lewati duplikat".` }
    ),

  // ========================================================================
  // BANK ACCOUNT ERRORS - Kesalahan Akun Bank
  // ========================================================================
  
  BANK_ACCOUNT_NOT_FOUND: (id: number) => 
    new NotFoundError(
      `Bank account with ID ${id} not found`,
      { id, userMessage: `Akun bank dengan ID ${id} tidak ditemukan. Akun mungkin sudah dihapus.` }
    ),
  
  BANK_ACCOUNT_INACTIVE: (accountNumber: string) => 
    new BankStatementImportError(
      `Bank account ${accountNumber} is inactive`,
      400, 
      'BS_BANK_ACCOUNT_INACTIVE',
      { accountNumber, userMessage: `Akun bank ${accountNumber} tidak aktif. Silakan aktifkan akun tersebut di menu Bank Accounts.` }
    ),
  
  BANK_ACCOUNT_NOT_BELONG_TO_COMPANY: (accountNumber: string, companyName?: string) => 
    new BankStatementImportError(
      `Bank account ${accountNumber} does not belong to your company`,
      403, 
      'BS_BANK_ACCOUNT_COMPANY_MISMATCH',
      { accountNumber, companyName, userMessage: `Akun bank ${accountNumber} bukan milik perusahaan Anda. Silakan pilih akun bank yang benar.` }
    ),
  
  BANK_ACCOUNT_MISMATCH: (uploadAccountId: number, expectedAccountId: number) => 
    new BankStatementImportError(
      `Bank account mismatch during confirmation`,
      400, 
      'BS_BANK_ACCOUNT_MISMATCH',
      { uploadAccountId, expectedAccountId, userMessage: 'Terjadi ketidaksesuaian akun bank. Silakan hubungi administrator.' }
    ),
  
  NO_BANK_ACCOUNTS: () => 
    new BankStatementImportError(
      'No bank accounts available for the current company',
      400, 
      'BS_NO_BANK_ACCOUNTS',
      { userMessage: 'Tidak ada akun bank tersedia untuk perusahaan ini. Silakan tambah akun bank di menu Bank Accounts.' }
    ),

  // ========================================================================
  // PERMISSION & ACCESS ERRORS - Kesalahan Akses & Izin
  // ========================================================================
  
  COMPANY_ACCESS_DENIED: (companyId: string) => 
    new BankStatementImportError(
      `Access denied to company ${companyId}`,
      403, 
      'BS_COMPANY_ACCESS_DENIED',
      { companyId, userMessage: 'Anda tidak memiliki akses ke perusahaan ini. Silakan hubungi administrator.' }
    ),
  
  BRANCH_CONTEXT_REQUIRED: () => 
    new ValidationError(
      'Branch context is required. Please select a branch first.',
      { userMessage: 'Silakan pilih branch terlebih dahulu untuk mengakses fitur ini.' }
    ),
  
  PERMISSION_DENIED: (action: string) => 
    new BankStatementImportError(
      `Permission denied: ${action}`,
      403, 
      'BS_PERMISSION_DENIED',
      { action, userMessage: `Anda tidak memiliki izin untuk melakukan "${action}". Silakan hubungi administrator.` }
    ),

  // ========================================================================
  // OPERATION ERRORS - Kesalahan Operasi
  // ========================================================================
  
  CANNOT_DELETE_COMPLETED: () => 
    new BankStatementImportError(
      'Cannot delete a completed import',
      400, 
      'BS_CANNOT_DELETE_COMPLETED',
      { userMessage: 'Tidak dapat menghapus import yang sudah selesai. Data sudah terintegrasi dengan sistem.' }
    ),
  
  CANNOT_DELETE_PROCESSING: () => 
    new BankStatementImportError(
      'Cannot delete an import that is currently being processed',
      400, 
      'BS_CANNOT_DELETE_PROCESSING',
      { userMessage: 'Tidak dapat menghapus import yang sedang diproses. Tunggu hingga proses selesai atau hubungi administrator.' }
    ),
  
  IMPORT_ALREADY_IN_PROGRESS: (id: number) => 
    new BankStatementImportError(
      `Import ${id} is already being processed`,
      400, 
      'BS_IMPORT_IN_PROGRESS',
      { id, userMessage: 'Import sedang diproses. Silakan tunggu hingga selesai.' }
    ),

  // ========================================================================
  // PROCESSING ERRORS - Kesalahan Pemrosesan
  // ========================================================================
  
  PROCESSING_FAILED: (error: string, phase: string) => 
    new BankStatementImportError(
      `Import processing failed: ${error}`,
      500, 
      'BS_PROCESSING_FAILED',
      { error, phase, userMessage: `Gagal memproses import pada tahap "${phase}". ${error}. Silakan coba lagi atau hubungi administrator.` }
    ),
  
  TEMPORARY_DATA_NOT_FOUND: () => 
    new ValidationError(
      'Temporary data not found. Please re-upload the file',
      { userMessage: 'Data sementara tidak ditemukan. Silakan upload file kembali.' }
    ),
  
  CONFIRMATION_FAILED: (error: string) => 
    new BankStatementImportError(
      `Failed to confirm import: ${error}`,
      500, 
      'BS_CONFIRMATION_FAILED',
      { error, userMessage: `Gagal mengkonfirmasi import: ${error}. Silakan coba lagi.` }
    ),

  // ========================================================================
  // GENERIC ERRORS - Kesalahan Umum
  // ========================================================================
  
  CREATE_FAILED: (operation: string = 'create') => 
    new BankStatementImportError(
      `Failed to ${operation} bank statement import`,
      500, 
      'BS_CREATE_FAILED',
      { operation, userMessage: `Gagal ${operation === 'create' ? 'membuat' : operation} data import. Silakan coba lagi.` }
    ),
  
  UPDATE_FAILED: (id: number, operation: string = 'update') => 
    new BankStatementImportError(
      `Failed to ${operation} bank statement import with id ${id}`,
      500, 
      'BS_UPDATE_FAILED',
      { id, operation, userMessage: `Gagal ${operation === 'update' ? 'memperbarui' : operation} data import dengan ID ${id}. Silakan coba lagi.` }
    ),
  
  DELETE_FAILED: (id: number) => 
    new BankStatementImportError(
      `Failed to delete bank statement import ${id}`,
      500, 
      'BS_DELETE_FAILED',
      { id, userMessage: `Gagal menghapus import dengan ID ${id}. Silakan coba lagi atau hubungi administrator.` }
    ),
  
  IMPORT_FAILED: (error?: string) => 
    new BankStatementImportError(
      `Failed to import bank statements${error ? `: ${error}` : ''}`,
      500, 
      'BS_IMPORT_FAILED',
      { error, userMessage: `Gagal mengimpor bank statements.${error ? ` ${error}` : ''} Silakan coba lagi.` }
    ),
  
  FETCH_FAILED: (operation: string) => 
    new BankStatementImportError(
      `Failed to fetch ${operation}`,
      500, 
      'BS_FETCH_FAILED',
      { operation, userMessage: `Gagal memuat ${operation}. Silakan refresh halaman atau coba lagi.` }
    ),
  
  UNKNOWN_ERROR: (error: string) => 
    new BankStatementImportError(
      `An unexpected error occurred: ${error}`,
      500, 
      'BS_UNKNOWN_ERROR',
      { error, userMessage: `Terjadi kesalahan yang tidak terduga. ${error}. Silakan hubungi administrator jika masalah berlanjut.` }
    ),
}

// ============================================================================
// ERROR UTILITY FUNCTIONS
// ============================================================================

/**
 * Get user-friendly error message
 * Prioritaskan pesan Indonesia dari context.userMessage
 */
export function getUserFriendlyErrorMessage(error: AppError): string {
  // Prioritas 1: Indonesian message from context
  if (error.context?.userMessage && typeof error.context.userMessage === 'string') {
    return error.context.userMessage
  }
  
  // Prioritas 2: Original message (bilingual support)
  return error.message
}

/**
 * Get error code from error
 */
export function getErrorCode(error: AppError): string {
  return (error as any).code || 'BS_UNKNOWN_ERROR'
}

/**
 * Check if error is retryable
 */
export function isErrorRetryable(error: AppError): boolean {
  const retryableCodes = [
    'BS_FILE_TOO_LARGE',
    'BS_INVALID_EXCEL_FORMAT',
    'BS_PROCESSING_FAILED',
    'BS_CREATE_FAILED',
    'BS_UPDATE_FAILED',
    'BS_DELETE_FAILED',
    'BS_IMPORT_FAILED',
    'BS_FETCH_FAILED',
    'BS_CONFIRMATION_FAILED',
  ]
  
  const code = getErrorCode(error)
  return retryableCodes.includes(code)
}

/**
 * Get recovery suggestion based on error
 */
export function getErrorRecoverySuggestion(error: AppError): string {
  const code = getErrorCode(error)
  
  const suggestions: Record<string, string> = {
    'BS_FILE_TOO_LARGE': 'Coba kompres file atau gunakan file dengan ukuran lebih kecil',
    'BS_INVALID_FILE_TYPE': 'Gunakan format file yang didukung: .xlsx, .xls, atau .csv',
    'BS_EMPTY_FILE': 'Pastikan file berisi data yang valid',
    'BS_CORRUPTED_FILE': 'Buka file di Excel dan simpan ulang, atau gunakan file cadangan',
    'BS_MISSING_REQUIRED_COLUMNS': 'Gunakan template yang disediakan dan lengkapi kolom yang缺少',
    'BS_INVALID_DATE_FORMAT': 'Gunakan format tanggal yang benar (YYYY-MM-DD)',
    'BS_BANK_ACCOUNT_NOT_FOUND': 'Pilih akun bank yang tersedia dari dropdown',
    'BS_BANK_ACCOUNT_INACTIVE': 'Aktifkan akun bank di menu Bank Accounts',
    'BS_BRANCH_CONTEXT_REQUIRED': 'Pilih branch di selector bagian kiri atas',
    'BS_IMPORT_NOT_FOUND': 'Refresh halaman untuk memperbarui daftar',
    'BS_DUPLICATE_FILE': 'Gunakan file yang berbeda atau hapus import sebelumnya',
    'BS_PERMISSION_DENIED': 'Hubungi administrator untuk mendapatkan akses',
  }
  
  return suggestions[code] || 'Silakan coba lagi atau hubungi administrator jika masalah berlanjut'
}

// ============================================================================
// ERROR CONSTANTS
// ============================================================================

export const BankStatementImportConfig = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ],
  REQUIRED_COLUMNS: ['transaction_date', 'description', 'credit_amount'],
  OPTIONAL_COLUMNS: ['transaction_time', 'reference_number', 'debit_amount', 'balance', 'transaction_type'],
  
  VALID_STATUS_TRANSITIONS: {
    'PENDING': ['ANALYZED'],
    'ANALYZED': ['IMPORTING', 'COMPLETED', 'FAILED'],
    'IMPORTING': ['COMPLETED', 'FAILED'],
    'COMPLETED': [],
    'FAILED': ['PENDING'] // Allow retry
  } as Record<string, string[]>,
  
  BATCH_SIZE: 1000, // Rows per batch insert
  
  DATE_FORMATS: [
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'DD-MM-YYYY',
    'YYYY/MM/DD'
  ]
}

