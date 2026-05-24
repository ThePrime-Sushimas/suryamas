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
  dueDateFrom: string
  dueDateTo: string
  receivedDateFrom: string
  receivedDateTo: string
}

export type ApPaymentFilterPatch = Partial<ApPaymentFilters>

export interface ApPaymentListQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
  supplier_id?: string
  branch_id?: string
  payment_method?: ApPaymentMethod
  date_from?: string
  date_to?: string
  due_date_from?: string
  due_date_to?: string
  received_date_from?: string
  received_date_to?: string
}
