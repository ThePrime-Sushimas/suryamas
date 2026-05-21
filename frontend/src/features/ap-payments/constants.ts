import type { ApPaymentMethod, ApPaymentStatus } from './api/apPayments.api'

export const AP_PAYMENTS_LIST_PATH = '/finance/ap-payments'
export const AP_DASHBOARD_PATH = '/finance/ap-payments/dashboard'

export const AP_STATUS_CONFIG: Record<
  ApPaymentStatus,
  { label: string; color: string }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  PENDING_APPROVAL: {
    label: 'Menunggu Approval',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  APPROVED: {
    label: 'Disetujui',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  REJECTED: {
    label: 'Ditolak',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  PAID: {
    label: 'Sudah Dibayar',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  RECONCILED: {
    label: 'Reconciled',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
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
