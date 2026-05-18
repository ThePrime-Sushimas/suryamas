import type { PO_STATUS_CONFIG } from '../constants'

export type PurchaseOrderStatus = keyof typeof PO_STATUS_CONFIG

export type PurchaseOrderListTab = 'all' | 'active' | 'receiving' | 'done'

export type PurchaseOrderSortField = 'order_date' | 'po_number' | 'total_amount' | 'created_at'

export type PurchaseOrderSortOrder = 'asc' | 'desc'

/** Canonical list filter state (URL + UI) */
export interface PurchaseOrderFilters {
  page: number
  limit: number
  search: string
  status: string
  supplierId: string
  branchId: string
  tab: PurchaseOrderListTab
  sortBy: PurchaseOrderSortField
  sortOrder: PurchaseOrderSortOrder
  dateFrom: string
  dateTo: string
}

/** Params passed to usePurchaseOrders / GET /purchase-orders */
export interface PurchaseOrderListQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
  supplier_id?: string
  branch_id?: string
  date_from?: string
  date_to?: string
}

export type PurchaseOrderFilterPatch = Partial<PurchaseOrderFilters>
