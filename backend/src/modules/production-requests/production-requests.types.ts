export type ProductionRequestStatus = 'DRAFT' | 'ACCEPTED' | 'RECEIVED' | 'CANCELLED'

export interface ProductionRequest {
  id: string
  company_id: string
  request_number: string
  status: ProductionRequestStatus
  requesting_branch_id: string
  fulfilling_branch_id: string
  request_date: string
  notes: string | null
  accepted_at: string | null
  accepted_by: string | null
  accept_notes: string | null
  received_at: string | null
  received_by: string | null
  receive_notes: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  stock_transfer_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface ProductionRequestWithRelations extends ProductionRequest {
  requesting_branch_name: string
  fulfilling_branch_name: string
  accepted_by_name: string | null
  received_by_name: string | null
  created_by_name: string | null
  line_count: number
  stock_transfer_number: string | null
}

export interface ProductionRequestLine {
  id: string
  production_request_id: string
  wip_id: string
  qty_batch: number
  qty_batch_approved: number | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface ProductionRequestLineWithRelations extends ProductionRequestLine {
  wip_code: string
  wip_name: string
  yield_qty: number
  uom: string
}

export interface ProductionRequestDetail extends ProductionRequestWithRelations {
  lines: ProductionRequestLineWithRelations[]
}

// DTOs
export interface CreateProductionRequestLineDto {
  wip_id: string
  qty_batch: number
  notes?: string | null
}

export interface CreateProductionRequestDto {
  requesting_branch_id: string
  fulfilling_branch_id: string
  request_date: string
  notes?: string | null
  lines: CreateProductionRequestLineDto[]
  created_by?: string
}

export interface UpdateProductionRequestDto {
  fulfilling_branch_id?: string
  request_date?: string
  notes?: string | null
  lines?: CreateProductionRequestLineDto[]
  updated_by?: string
}

export interface AcceptProductionRequestDto {
  accept_notes?: string | null
  lines?: { id: string; qty_batch_approved: number }[]
  accepted_by: string
}

export interface ReceiveProductionRequestDto {
  receive_notes?: string | null
  received_by: string
}

export interface CancelProductionRequestDto {
  cancel_reason?: string
  cancelled_by: string
}
