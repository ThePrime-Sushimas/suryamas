import type { BankStatementImport, BankStatementImportStatus } from '../types/bank-statement-import.types'
import { BANK_STATEMENT_IMPORT_STATUS_LABELS } from '../constants/bank-statement-import.constants'

export function formatImportStatus(status: BankStatementImportStatus): string {
  return BANK_STATEMENT_IMPORT_STATUS_LABELS[status] ?? status
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}

export function formatDate(date?: string | Date | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID')
}

export function formatDateRange(importItem: BankStatementImport): string {
  // Use date_from/date_to if available, otherwise use backend field names
  const dateFrom = importItem.date_from ?? importItem.date_range_start
  const dateTo = importItem.date_to ?? importItem.date_range_end
  
  if (!dateFrom && !dateTo) return '-'
  const from = dateFrom ? formatDate(dateFrom) : '?'
  const to = dateTo ? formatDate(dateTo) : '?'
  return `${from} - ${to}`
}

