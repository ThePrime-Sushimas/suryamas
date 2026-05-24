import type { PurchaseInvoiceListTab } from '../constants'

export interface PurchaseInvoiceFilters {
  page: number
  limit: number
  search: string
  supplierId: string
  branchId: string
  tab: PurchaseInvoiceListTab
}

export type PurchaseInvoiceFilterPatch = Partial<PurchaseInvoiceFilters>

export interface PurchaseInvoiceListQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
  supplier_id?: string
  branch_id?: string
}
