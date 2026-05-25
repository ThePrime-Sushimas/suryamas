import type { ApPaymentMethod, ApPaymentStatus } from './api/apPayments.api'

export const AP_PAYMENTS_LIST_PATH = '/finance/ap-payments'
export const AP_DASHBOARD_PATH = '/finance/ap-payments/dashboard'

export function apPaymentBatchPath(batchId: string) {
  return `/finance/ap-payments/batches/${batchId}`
}
/** sessionStorage key: after bulk create, open the payments panel on this tab */
export const AP_PAYMENTS_PAY_TAB_KEY = 'ap_payments_pay_tab'

export const AP_STATUS_CONFIG: Record<
  ApPaymentStatus,
  { label: string; color: string }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-gray-700 dark:text-gray-300 dark:border-transparent',
  },
  PENDING_APPROVAL: {
    label: 'Menunggu Approval',
    color: 'bg-pink-100 text-pink-700 border border-pink-200/80 dark:bg-blue-900/30 dark:text-blue-300 dark:border-transparent',
  },
  APPROVED: {
    label: 'Menunggu Pembayaran',
    color: 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-900/30 dark:text-amber-300 dark:border-transparent',
  },
  REJECTED: {
    label: 'Ditolak',
    color: 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-transparent',
  },
  PAID: {
    label: 'Sudah Dibayar',
    color: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-transparent',
  },
  RECONCILED: {
    label: 'Reconciled',
    color: 'bg-green-50 text-green-800 border border-green-200/80 dark:bg-green-900/30 dark:text-green-300 dark:border-transparent',
  },
}

export const AP_PAYMENT_METHOD_LABELS: Record<ApPaymentMethod, string> = {
  TRANSFER: 'Transfer',
  CASH: 'Tunai',
  CHECK: 'Cek',
  GIRO: 'Giro',
}

export const AP_LIST_TABS = [
  { id: 'outstanding', label: 'Invoice Outstanding' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending', label: 'Menunggu Pembayaran' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'Semua' },
] as const

export type ApPaymentListTab = (typeof AP_LIST_TABS)[number]['id']

export const AP_JOURNAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Diajukan',
  APPROVED: 'Disetujui',
  POSTED: 'Posted',
  REJECTED: 'Ditolak',
  REVERSED: 'Reversed',
}

export const AP_LIST_TAB_STATUS: Record<ApPaymentListTab, ApPaymentStatus | ''> = {
  outstanding: '',
  draft: 'DRAFT',
  pending: 'APPROVED',
  paid: 'PAID',
  all: '',
}
