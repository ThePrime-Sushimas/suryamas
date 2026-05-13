export type GoodsProcessingType = 'PASS_THROUGH' | 'DISASSEMBLY'
export type GoodsProcessingStatus = 'DRAFT' | 'PROCESSING' | 'QC_REVIEW' | 'CONFIRMED' | 'REJECTED'

export interface GoodsProcessing {
  id: string
  company_id: string
  branch_id: string
  warehouse_id: string
  goods_receipt_id: string
  processing_number: string
  processing_date: string
  processing_type: GoodsProcessingType
  status: GoodsProcessingStatus
  notes: string | null
  rejection_reason: string | null
  processed_by: string | null
  processed_at: string | null
  qc_confirmed_by: string | null
  qc_confirmed_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  total_input_qty: number | null
  total_output_qty: number | null
  total_waste_qty: number | null
  yield_percentage: number | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface GoodsProcessingWithRelations extends GoodsProcessing {
  branch_name: string
  branch_code: string
  warehouse_name: string
  gr_number: string
  supplier_name: string
  input_count: number
}

export interface GoodsProcessingInput {
  id: string
  goods_processing_id: string
  gr_line_id: string
  product_id: string
  qty_input: number
  uom: string
  sort_order: number
}

export interface GoodsProcessingInputWithProduct extends GoodsProcessingInput {
  product_code: string
  product_name: string
  requires_processing: boolean
}

export interface GoodsProcessingOutput {
  id: string
  goods_processing_id: string
  input_id: string
  product_id: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason: string | null
  photo_urls: string[] | null
  unit_cost: number | null
  allocated_cost: number | null
  stock_movement_id: string | null
  purchase_invoice_line_id: string | null
  warehouse_id: string | null
  sort_order: number
}

export interface GoodsProcessingOutputWithProduct extends GoodsProcessingOutput {
  product_code: string
  product_name: string
}

export interface GoodsProcessingDetail extends GoodsProcessingWithRelations {
  inputs: (GoodsProcessingInputWithProduct & { outputs: GoodsProcessingOutputWithProduct[] })[]
}

// DTOs
export interface UpdateOutputDto {
  id?: string
  product_id: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason?: string | null
  photo_urls?: string[] | null
  sort_order?: number
}

export interface UpdateGoodsProcessingDto {
  processing_type?: GoodsProcessingType
  notes?: string | null
  inputs: {
    id: string
    outputs: UpdateOutputDto[]
  }[]
}

export interface RejectDto {
  rejection_reason: string
}
