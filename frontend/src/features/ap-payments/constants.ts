import type { ApPaymentMethod, ApPaymentStatus } from './api/apPayments.api'

export const AP_PAYMENTS_LIST_PATH = '/finance/ap-payments'
export const AP_DASHBOARD_PATH = '/finance/ap-payments/dashboard'

export const AP_STATUS_CONFIG: Record<
  ApPaymentStatus,
  { label: string; color: string }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-200',
  },
  PENDING_APPROVAL: {
    label: 'Menunggu Approval',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/35 dark:text-pink-200',
  },
  APPROVED: {
    label: 'Disetujui',
    color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/35 dark:text-fuchsia-200',
  },
  REJECTED: {
    label: 'Ditolak',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  PAID: {
    label: 'Sudah Dibayar',
    color: 'bg-pink-200/80 text-pink-800 dark:bg-pink-900/40 dark:text-pink-100',
  },
  RECONCILED: {
    label: 'Reconciled',
    color: 'bg-rose-200/70 text-rose-800 dark:bg-rose-900/50 dark:text-rose-100',
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
