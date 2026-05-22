import type { ApPaymentMethod, ApPaymentStatus } from '../api/apPayments.api'
import type { ApPaymentListTab } from '../constants'

export interface ApPaymentFilters {
  page: number
  limit: number
  search: string
  status: ApPaymentStatus | ''
  supplierId: string
  branchId: string
  paymentMethod: ApPaymentMethod | ''
  tab: ApPaymentListTab
  dateFrom: string
  dateTo: string
  bulkOnly: boolean
}

export type ApPaymentFilterPatch = Partial<ApPaymentFilters>

export interface ApPaymentListQuery {
  page?: number
  limit?: number
  search?: string
  status?: ApPaymentStatus
  supplier_id?: string
  branch_id?: string
  payment_method?: ApPaymentMethod
  date_from?: string
  date_to?: string
  bulk_only?: boolean
}
