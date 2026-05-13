export type PurchaseRequestStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CANCELLED'
export type PurchaseRequestPriority = 'normal' | 'medium' | 'high'

export interface PurchaseRequest {
  id: string
  company_id: string
  branch_id: string
  request_number: string
  status: PurchaseRequestStatus
  priority: PurchaseRequestPriority
  request_date: string
  needed_by_date: string | null
  notes: string | null
  requested_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PurchaseRequestWithRelations extends PurchaseRequest {
  branch_name: string
  branch_code: string
  requested_by_name: string | null
  approved_by_name: string | null
  line_count: number
  total_estimated: number
  total_pricelist: number
}

export interface PurchaseRequestLine {
  id: string
  request_id: string
  product_id: string
  qty: number
  qty_approved: number | null
  uom: string
  estimated_price: number | null
  supplier_id: string | null
  notes: string | null
  sort_order: number
}

export interface PurchaseRequestLineWithRelations extends PurchaseRequestLine {
  product_code: string
  product_name: string
  supplier_name: string | null
  qty_ordered: number
  qty_received: number
}

export interface PurchaseRequestWithLines extends PurchaseRequestWithRelations {
  lines: PurchaseRequestLineWithRelations[]
  purchase_orders?: Array<{ id: string; po_number: string; status: string; supplier_name: string }>
}

// DTOs
export interface CreatePurchaseRequestLineDto {
  product_id: string
  qty: number
  uom: string
  estimated_price?: number | null
  supplier_id?: string | null
  notes?: string | null
}

export interface CreatePurchaseRequestDto {
  branch_id: string
  request_date?: string
  needed_by_date?: string | null
  priority?: PurchaseRequestPriority
  notes?: string | null
  lines: CreatePurchaseRequestLineDto[]
  created_by?: string
  updated_by?: string
}

export interface UpdatePurchaseRequestDto {
  needed_by_date?: string | null
  notes?: string | null
  lines?: CreatePurchaseRequestLineDto[]
  updated_by?: string
}

export interface ApprovePurchaseRequestDto {
  approved_by: string
}

export interface RejectPurchaseRequestDto {
  rejected_reason: string
  rejected_by: string
}
