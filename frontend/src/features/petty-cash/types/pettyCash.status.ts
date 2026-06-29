import type { PettyCashRequestStatus } from './pettyCash.types'

export const PETTY_CASH_STATUS_LABELS: Record<PettyCashRequestStatus, string> = {
  PENDING: 'Pending',
  DISBURSED: 'Aktif',
  CLOSED: 'Selesai',
  REJECTED: 'Ditolak',
}
