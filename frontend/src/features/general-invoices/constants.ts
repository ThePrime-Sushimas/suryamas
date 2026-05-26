import type { ExpenseType, VendorType, GeneralInvoiceStatus, GeneralPaymentStatus } from './api/generalApi.api'

// ─── Labels ───────────────────────────────────────────────────
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  UTILITY: 'Utilitas',
  RENT: 'Sewa',
  SALARY_SUPPORT: 'Support Gaji',
  SUBSCRIPTION: 'Langganan',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Lainnya',
}

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  UTILITY: 'Utilitas',
  RENT: 'Sewa',
  SERVICE: 'Jasa',
  SUBSCRIPTION: 'Langganan',
  OTHER: 'Lainnya',
}

export const INVOICE_STATUS_LABELS: Record<GeneralInvoiceStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Sudah Posting',
  CANCELLED: 'Dibatalkan',
}

export const PAYMENT_STATUS_LABELS: Record<GeneralPaymentStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  PAID: 'Lunas',
  RECONCILED: 'Rekonsiliasi',
}

// ─── Badge colors (Tailwind) ──────────────────────────────────
export const INVOICE_STATUS_COLORS: Record<GeneralInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  POSTED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export const PAYMENT_STATUS_COLORS: Record<GeneralPaymentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  APPROVED: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAID: 'bg-green-100 text-green-700',
  RECONCILED: 'bg-teal-100 text-teal-700',
}

// ─── Formatters ───────────────────────────────────────────────
export const formatRupiah = (n: number | null | undefined) => {
  if (n == null) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export const formatDate = (d: string | null | undefined) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const isOverdue = (dueDate: string | null) => {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

// ─── Select options ───────────────────────────────────────────
export const EXPENSE_TYPE_OPTIONS = (Object.entries(EXPENSE_TYPE_LABELS) as [ExpenseType, string][])
  .map(([value, label]) => ({ value, label }))

export const VENDOR_TYPE_OPTIONS = (Object.entries(VENDOR_TYPE_LABELS) as [VendorType, string][])
  .map(([value, label]) => ({ value, label }))

export const INVOICE_STATUS_OPTIONS = (Object.entries(INVOICE_STATUS_LABELS) as [GeneralInvoiceStatus, string][])
  .map(([value, label]) => ({ value, label }))

export const PAYMENT_STATUS_OPTIONS = (Object.entries(PAYMENT_STATUS_LABELS) as [GeneralPaymentStatus, string][])
  .map(([value, label]) => ({ value, label }))

export const RECURRENCE_OPTIONS = [
  { value: 'MONTHLY', label: 'Bulanan' },
  { value: 'QUARTERLY', label: 'Kuartalan' },
  { value: 'YEARLY', label: 'Tahunan' },
]

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'TRANSFER', label: 'Transfer Bank' },
  { value: 'CASH', label: 'Tunai' },
]