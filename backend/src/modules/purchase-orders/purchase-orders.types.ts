import type { CalculationType } from '../payment-terms/payment-terms.types'
import type { PoPaymentDueInfo } from './purchase-order-payment.util'

export type PurchaseOrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'ORDERED' | 'PARTIAL_RECEIVED' | 'FULLY_RECEIVED' | 'CLOSED' | 'CANCELLED'
export type PaymentType = 'CASH' | 'CREDIT'

export type { PoPaymentDueInfo }

export interface PurchaseOrder {
  id: string
  company_id: string
  branch_id: string
  supplier_id: string
  purchase_request_id: string
  po_number: string
  status: PurchaseOrderStatus
  order_date: string
  expected_delivery_date: string | null
  payment_type: PaymentType
  payment_term_id: number | null
  payment_terms_days: number | null
  payment_due_date: string | null
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  cancelled_reason: string | null
  total_amount: number
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PurchaseOrderWithRelations extends PurchaseOrder {
  branch_name: string
  branch_code: string
  supplier_name: string
  supplier_code: string
  invoice_bypass_reason: 'marketplace' | 'cash' | 'informal' | null
  request_number: string
  approved_by_name: string | null
  line_count: number
}

export interface PurchaseOrderLine {
  id: string
  po_id: string
  pr_line_id: string | null
  product_id: string
  supplier_product_id: string | null
  qty: number
  qty_received: number
  qty_short_closed: number
  short_close_reason: string | null
  uom: string
  unit_price: number
  total_price: number
  notes: string | null
  sort_order: number
}

export interface PurchaseOrderLineWithRelations extends PurchaseOrderLine {
  product_code: string
  product_name: string
}

export interface PurchaseOrderWithLines extends PurchaseOrderWithRelations {
  lines: PurchaseOrderLineWithRelations[]
}

export interface PurchaseOrderDetail extends PurchaseOrderWithLines {
  payment_term_name: string | null
  payment_due_info: PoPaymentDueInfo | null
}

// DTOs
export interface CreatePurchaseOrderLineDto {
  pr_line_id?: string | null
  product_id: string
  supplier_product_id?: string | null
  qty: number
  uom: string
  unit_price: number
  notes?: string | null
}

export interface CreatePurchaseOrderDto {
  branch_id: string
  supplier_id: string
  purchase_request_id: string
  order_date?: string
  expected_delivery_date?: string | null
  payment_type: PaymentType
  payment_term_id?: number | null
  payment_terms_days?: number | null
  notes?: string | null
  lines: CreatePurchaseOrderLineDto[]
  created_by?: string
}

export interface UpdatePurchaseOrderDto {
  expected_delivery_date?: string | null
  notes?: string | null
  lines?: CreatePurchaseOrderLineDto[]
  updated_by?: string
}

export type PoShortCloseReason =
  | 'SUPPLIER_OUT_OF_STOCK'
  | 'SUPPLIER_CANCELLED'
  | 'SUBSTITUTE_UNAVAILABLE'
  | 'OTHER'

export interface ShortClosePoLineDto {
  po_line_id: string
  qty: number
  reason: PoShortCloseReason
  notes?: string | null
}
