import type { ApPaymentMethod, ApPaymentStatus } from './api/apPayments.api'

export const AP_PAYMENTS_LIST_PATH = '/finance/ap-payments'
export const AP_DASHBOARD_PATH = '/finance/ap-payments/dashboard'

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
    label: 'Disetujui',
    color: 'bg-rose-100 text-rose-700 border border-rose-200/80 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-transparent',
  },
  REJECTED: {
    label: 'Ditolak',
    color: 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-transparent',
  },
  PAID: {
    label: 'Sudah Dibayar',
    color: 'bg-pink-100 text-pink-800 border border-pink-200/80 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-transparent',
  },
  RECONCILED: {
    label: 'Reconciled',
    color: 'bg-rose-100 text-rose-800 border border-rose-200/80 dark:bg-green-900/30 dark:text-green-300 dark:border-transparent',
  },
}

export const AP_PAYMENT_METHOD_LABELS: Record<ApPaymentMethod, string> = {
  TRANSFER: 'Transfer',
  CASH: 'Tunai',
  CHECK: 'Cek',
  GIRO: 'Giro',
}

export const AP_LIST_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending', label: 'Approval' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
] as const

export type ApPaymentListTab = (typeof AP_LIST_TABS)[number]['id']

export const AP_LIST_TAB_STATUS: Record<ApPaymentListTab, ApPaymentStatus | ''> = {
  all: '',
  draft: 'DRAFT',
  pending: 'PENDING_APPROVAL',
  approved: 'APPROVED',
  rejected: 'REJECTED',
}
