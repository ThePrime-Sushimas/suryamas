import type { PurchaseInvoiceListTab } from '../constants'

export interface PurchaseInvoiceFilters {
  page: number
  limit: number
  supplierId: string
  branchId: string
  tab: PurchaseInvoiceListTab
}

export type PurchaseInvoiceFilterPatch = Partial<PurchaseInvoiceFilters>

export interface PurchaseInvoiceListQuery {
  page?: number
  limit?: number
  status?: string
  supplier_id?: string
  branch_id?: string
}
