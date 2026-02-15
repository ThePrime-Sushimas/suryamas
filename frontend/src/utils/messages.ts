/**
 * Centralized Messages / Localization Keys
 * 
 * This file contains all user-facing messages in the application.
 * For full i18n support, consider using react-i18next with these keys.
 * 
 * Current approach: Simple key-based lookup (can be migrated to i18n later)
 */

// =============================================================================
// POS AGGREGATES MESSAGES
// =============================================================================

export const POS_AGGREGATES_MESSAGES = {
  // Success messages
  TRANSACTION_CREATED: 'Transaksi agregat berhasil dibuat',
  TRANSACTION_UPDATED: 'Transaksi agregat berhasil diperbarui',
  TRANSACTION_DELETED: (sourceRef: string) => `Transaksi "${sourceRef}" berhasil dihapus`,
  TRANSACTION_RESTORED: (sourceRef: string) => `Transaksi "${sourceRef}" berhasil dipulihkan`,
  TRANSACTION_RECONCILED: 'Transaksi berhasil direkonsiliasi',
  TRANSACTION_BATCH_RECONCILED: (count: number) => `${count} transaksi berhasil direkonsiliasi`,
  TRANSACTION_MATCHED: (sourceRef: string) => `Transaksi "${sourceRef}" berhasil dicocokkan dengan mutasi bank`,
  TRANSACTION_SAVED: 'Transaksi berhasil disimpan',

  // Error messages
  TRANSACTION_CREATE_FAILED: 'Gagal membuat transaksi',
  TRANSACTION_UPDATE_FAILED: 'Gagal memperbarui transaksi',
  TRANSACTION_DELETE_FAILED: 'Gagal menghapus transaksi',
  TRANSACTION_RESTORE_FAILED: 'Gagal memulihkan transaksi',
  TRANSACTION_RECONCILE_FAILED: 'Gagal merekonsiliasi transaksi',
  TRANSACTION_BATCH_RECONCILE_FAILED: 'Gagal merekonsiliasi transaksi secara batch',
  TRANSACTION_MATCH_FAILED: 'Gagal mencocokkan transaksi',
  TRANSACTION_SAVE_FAILED: 'Gagal menyimpan transaksi',
  TRANSACTION_NOT_FOUND: 'Transaksi tidak ditemukan atau telah dihapus',
  TRANSACTION_FETCH_FAILED: 'Gagal mengambil data transaksi',
  INVALID_TRANSACTION_ID: 'ID transaksi tidak valid',
  TRANSACTION_ALREADY_RECONCILED: 'Transaksi sudah direkonsiliasi',

  // Selection messages
  SELECT_TRANSACTIONS_TO_RECONCILE: 'Pilih transaksi yang akan direkonsiliasi',
  NO_TRANSACTION_SELECTED: 'Tidak ada transaksi dipilih',
  TRANSACTION_SELECTED: (count: number) => `${count} transaksi dipilih`,
} as const;

// =============================================================================
// POS IMPORTS MESSAGES
// =============================================================================

export const POS_IMPORTS_MESSAGES = {
  // Success messages
  FILE_UPLOADED: 'File uploaded successfully',
  IMPORT_CONFIRMED: 'Import confirmed successfully',
  IMPORT_DELETED: 'Import deleted successfully',
  BATCH_IMPORTS_DELETED: (count: number) => `${count} imports deleted successfully`,
  BATCH_IMPORTS_CONFIRMED: (count: number) => `${count} imports confirmed successfully`,
  EXPORT_JOB_CREATED: (count: number) => `Export job created. Processing ${count} imports in background...`,
  ANALYSIS_COMPLETE: 'Analysis complete',
  ANALYSIS_CLEARED: 'Analysis cleared',

  // Error messages
  UPLOAD_FAILED: 'Upload failed',
  CONFIRM_FAILED: 'Confirm failed',
  DELETE_FAILED: 'Delete failed',
  BATCH_DELETE_FAILED: 'Batch delete failed',
  BATCH_CONFIRM_FAILED: 'Batch confirm failed',
  EXPORT_JOB_FAILED: 'Failed to create export job',
  FETCH_IMPORTS_FAILED: 'Gagal mengambil data import',
  NO_ANALYZED_SELECTED: 'No analyzed imports selected',
  USER_NOT_AUTHENTICATED: 'User not authenticated',

  // General errors
  GENERAL_ERROR: 'An error occurred',
} as const;

// =============================================================================
// BANK RECONCILIATION MESSAGES
// =============================================================================

export const BANK_RECONCILIATION_MESSAGES = {
  // Success messages
  BANK_MUTATION_MATCHED: 'Berhasil dicocokkan dengan mutasi bank',
  JOURNAL_CREATED: 'Jurnal berhasil dibuat',
  GENERATE_COMPLETED: 'Generate completed!',
  JOB_CREATED: 'Job created. Processing in background.',

  // Error messages
  FETCH_BANK_MUTATIONS_FAILED: 'Gagal mengambil data mutasi bank yang belum dicocokkan',
  MATCH_FAILED: 'Gagal mencocokkan mutasi bank',
  JOURNAL_CREATE_FAILED: 'Gagal membuat jurnal',
  GENERATE_FAILED: 'Gagal generate dari import',
} as const;

// =============================================================================
// FAILED TRANSACTIONS MESSAGES
// =============================================================================

export const FAILED_TRANSACTIONS_MESSAGES = {
  // Success messages
  TRANSACTION_FIXED: 'Transaksi berhasil difix dan diproses ulang',
  TRANSACTION_FIXED_BATCH: (count: number) => `${count} transaksi berhasil difix`,
  TRANSACTION_DELETED: 'Transaksi gagal dihapus permanen', // Note: Success message but confusing name
  TRANSACTION_SELECTED_DELETED: 'Transaksi terpilih dihapus',

  // Error messages
  TRANSACTION_FIX_FAILED: 'Gagal reset transaksi',
  TRANSACTION_DELETE_FAILED: 'Gagal menghapus transaksi',

  // Info/Warning messages
  NO_FAILED_TRANSACTIONS: 'Tidak ada transaksi dipilih',
  ALL_TRANSACTIONS_PROCESSED: 'Semua transaksi berhasil diproses',
  BATCH_FIX_WARNING: (count: number) => `${count} transaksi gagal difix`,
} as const;

// =============================================================================
// FORM VALIDATION MESSAGES
// =============================================================================

export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'Field ini wajib diisi',
  INVALID_EMAIL: 'Email tidak valid',
  INVALID_NUMBER: 'Nomor tidak valid',
  MIN_LENGTH: (min: number) => `Minimal ${min} karakter`,
  MAX_LENGTH: (max: number) => `Maksimal ${max} karakter`,
} as const;

// =============================================================================
// GENERIC MESSAGES
// =============================================================================

export const GENERIC_MESSAGES = {
  // Success
  SUCCESS: 'Berhasil',
  CREATED: 'Berhasil dibuat',
  UPDATED: 'Berhasil diperbarui',
  DELETED: 'Berhasil dihapus',
  SAVED: 'Berhasil disimpan',
  LOADED: 'Berhasil dimuat',
  PROCESSED: 'Berhasil diproses',

  // Error
  ERROR: 'Terjadi kesalahan',
  FAILED: 'Gagal',
  NETWORK_ERROR: 'Kesalahan jaringan',
  UNKNOWN_ERROR: 'Terjadi kesalahan yang tidak diketahui',

  // Loading
  LOADING: 'Memuat...',
  PROCESSING: 'Memproses...',

  // Actions
  CANCEL: 'Batal',
  CONFIRM: 'Konfirmasi',
  SAVE: 'Simpan',
  DELETE: 'Hapus',
  EDIT: 'Edit',
  VIEW: 'Lihat',
  CLOSE: 'Tutup',
  RETRY: 'Coba Lagi',
  RELOAD: 'Muat Ulang',
} as const;

// =============================================================================
// HELPER FUNCTION
// =============================================================================

/**
 * Get message by key path
 * Example: getMessage('posAggregates.TRANSACTION_DELETED', sourceRef)
 */
export function getMessage(
  module: 'posAggregates' | 'posImports' | 'bankReconciliation' | 'failedTransactions' | 'validation' | 'generic',
  key: string,
  ...args: unknown[]
): string {
  const modules = {
    posAggregates: POS_AGGREGATES_MESSAGES,
    posImports: POS_IMPORTS_MESSAGES,
    bankReconciliation: BANK_RECONCILIATION_MESSAGES,
    failedTransactions: FAILED_TRANSACTIONS_MESSAGES,
    validation: VALIDATION_MESSAGES,
    generic: GENERIC_MESSAGES,
  };

  const moduleMessages = modules[module];
  const messageFn = (moduleMessages as Record<string, unknown>)[key];

  if (typeof messageFn === 'function') {
    return messageFn(...args);
  }

  if (typeof messageFn === 'string') {
    return messageFn;
  }

  return key;
}

