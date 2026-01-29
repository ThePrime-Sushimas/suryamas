import type { BankStatementImport, BankStatementImportStatus } from '../types/bank-statement-import.types'
import { BANK_STATEMENT_IMPORT_STATUS_LABELS } from '../constants/bank-statement-import.constants'

export function formatImportStatus(status: BankStatementImportStatus): string {
  return BANK_STATEMENT_IMPORT_STATUS_LABELS[status] ?? status
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(1)} ${units[i]}`
}

export function formatDate(date?: string | Date | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
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

