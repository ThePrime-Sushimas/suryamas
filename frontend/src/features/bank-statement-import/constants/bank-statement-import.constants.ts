import type { BankStatementImportStatus } from '../types/bank-statement-import.types'

export const BANK_STATEMENT_IMPORT_PAGE_SIZE = 20

export const BANK_STATEMENT_IMPORT_STATUS_COLORS: Record<BankStatementImportStatus, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  PENDING: 'warning',
  ANALYZED: 'info',
  IMPORTING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
}

export const BANK_STATEMENT_IMPORT_STATUS_LABELS: Record<BankStatementImportStatus, string> = {
  PENDING: 'Pending',
  ANALYZED: 'Sudah Dianalisis',
  IMPORTING: 'Sedang Mengimport',
  COMPLETED: 'Selesai',
  FAILED: 'Gagal',
}

export const BANK_STATEMENT_IMPORT_STATUS_ICONS: Record<BankStatementImportStatus, string> = {
  PENDING: 'Clock',
  ANALYZED: 'FileCheck',
  IMPORTING: 'Loader2',
  COMPLETED: 'CheckCircle',
  FAILED: 'XCircle',
}

// Quick filter options
export const BANK_STATEMENT_IMPORT_QUICK_FILTERS = [
  { label: 'Hari Ini', getValue: () => {
    const today = new Date().toISOString().split('T')[0]
    return { dateFrom: today, dateTo: today }
  }},
  { label: 'Minggu Ini', getValue: () => {
    const now = new Date()
    const start = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]
    return { dateFrom: start, dateTo: new Date().toISOString().split('T')[0] }
  }},
  { label: 'Bulan Ini', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    return { dateFrom: start, dateTo: new Date().toISOString().split('T')[0] }
  }},
]

