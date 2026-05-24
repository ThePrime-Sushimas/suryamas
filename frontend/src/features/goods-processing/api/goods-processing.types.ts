
// ── Condition & status enums ───────────────────────────────────────────────────

export type ConditionStatus = 'OK' | 'SHORTAGE' | 'DAMAGED'
/** QC_REVIEW may still appear from legacy DB rows — treat as PROCESSING in UI */
export type GoodsProcessingStatus = 'DRAFT' | 'PROCESSING' | 'PARTIAL' | 'QC_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'CORRECTING'
export type ProcessingType = 'PASS_THROUGH' | 'DISASSEMBLY'

// ── Output template ───────────────────────────────────────────────────────────

export interface OutputTemplateRow {
  id: string
  output_product_id: string
  output_product_name: string
  output_product_code: string
  output_uom: string
  suggested_pct: number | null
  sort_order: number
  notes: string | null
  bears_cost: boolean
}

// ── Detail response types ─────────────────────────────────────────────────────

export interface GoodsProcessingOutputWithProduct {
  id: string
  product_id: string
  product_name: string
  product_code: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason: string | null
  condition_status: ConditionStatus | null
  actual_qty: number | null
  actual_uom: string | null
  flagged_for_return: boolean
  return_reason: string | null
  return_resolved_at: string | null
  return_resolution: 'STOCK' | 'DISCARD' | null
  stock_movement_id: string | null
  sort_order: number
}

export interface GoodsProcessingInputWithTemplate {
  id: string
  gr_line_id: string
  product_id: string
  product_name: string
  product_code: string
  qty_input: number
  uom: string
  requires_processing: boolean
  output_template: OutputTemplateRow[]
  outputs: GoodsProcessingOutputWithProduct[]
  status?: 'PENDING' | 'PROCESSING' | 'DONE' | 'CONFIRMED' | 'QC_REVIEW' | 'REJECTED'
}

export interface GoodsProcessingDetail {
  id: string
  processing_number: string
  goods_receipt_id: string
  gr_number: string
  supplier_name: string
  warehouse_id: string
  warehouse_name: string
  branch_id: string
  branch_name: string
  processing_date: string
  processing_type: ProcessingType
  status: GoodsProcessingStatus
  rejection_reason: string | null
  total_input_qty: number | null
  total_output_qty: number | null
  yield_percentage: number | null
  inputs: GoodsProcessingInputWithTemplate[]
  created_at: string
  updated_at: string
}

export interface GoodsProcessingWithRelations {
  id: string
  processing_number: string
  goods_receipt_id: string
  gr_number: string
  supplier_name: string
  warehouse_name: string
  branch_name: string
  processing_date: string
  processing_type: ProcessingType
  status: GoodsProcessingStatus
  total_input_qty: number | null
  total_output_qty: number | null
  yield_percentage: number | null
  input_count: number | null
  done_input_count?: number | null
  item_names: string[]
  weighing_line_count?: number
  weighing_summary?: string | null
  created_at: string
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface UpdateOutputDto {
  id?: string
  product_id: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason: string | null
  condition_status: ConditionStatus | null
  actual_qty: number | null
  actual_uom: string | null
  flagged_for_return: boolean
  return_reason: string | null
  sort_order: number
}

export interface UpdateInputDto {
  id: string
  outputs: UpdateOutputDto[]
}

export interface UpdateGoodsProcessingDto {
  inputs: UpdateInputDto[]
}

export interface RejectDto {
  rejection_reason: string
}