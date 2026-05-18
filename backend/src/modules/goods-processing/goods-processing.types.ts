export type GoodsProcessingType = "PASS_THROUGH" | "DISASSEMBLY";
export type GoodsProcessingStatus =
  | "DRAFT"
  | "PROCESSING"
  | "QC_REVIEW"
  | "CONFIRMED"
  | "REJECTED";
export type ConditionStatus = "OK" | "DAMAGED" | "SHORTAGE";

export interface GoodsProcessing {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  goods_receipt_id: string;
  processing_number: string;
  processing_date: string;
  processing_type: GoodsProcessingType;
  status: GoodsProcessingStatus;
  notes: string | null;
  rejection_reason: string | null;
  processed_by: string | null;
  processed_at: string | null;
  qc_confirmed_by: string | null;
  qc_confirmed_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  total_input_qty: number | null;
  total_output_qty: number | null;
  total_waste_qty: number | null;
  yield_percentage: number | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface GoodsProcessingWithRelations extends GoodsProcessing {
  branch_name: string;
  branch_code: string;
  warehouse_name: string;
  gr_number: string;
  supplier_name: string;
  input_count: number;
  item_names: string[];
  weighing_line_count: number;
  weighing_summary: string | null;
}

export interface GoodsProcessingInput {
  id: string;
  goods_processing_id: string;
  gr_line_id: string;
  product_id: string;
  qty_input: number;
  uom: string;
  sort_order: number;
  status: "PENDING" | "PROCESSING" | "QC_REVIEW" | "CONFIRMED" | "REJECTED";
  processed_by: string | null;
  processed_at: string | null;
  qc_confirmed_by: string | null;
  qc_confirmed_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

export interface GoodsProcessingInputWithProduct extends GoodsProcessingInput {
  product_code: string;
  product_name: string;
  requires_processing: boolean;
  processed_by_name?: string | null;
  qc_confirmed_by_name?: string | null;
}

export interface GoodsProcessingOutput {
  id: string;
  goods_processing_id: string;
  input_id: string;
  product_id: string;
  qty_output: number;
  uom: string;
  is_waste: boolean;
  waste_reason: string | null;
  photo_urls: string[] | null;
  unit_cost: number | null;
  allocated_cost: number | null;
  stock_movement_id: string | null;
  purchase_invoice_line_id: string | null;
  warehouse_id: string | null;
  sort_order: number;
  // New fields from migration
  condition_status: ConditionStatus | null;
  actual_qty: number | null;
  actual_uom: string | null;
  flagged_for_return: boolean;
  return_reason: string | null;
  return_resolved_at: string | null;
}

export interface GoodsProcessingOutputWithProduct extends GoodsProcessingOutput {
  product_code: string;
  product_name: string;
  stock_movement_id: string | null; // tambah ini
  warehouse_id: string | null; // dan ini
}

export interface OutputTemplateRow {
  id: string;
  product_id: string;
  output_product_id: string;
  output_product_name: string;
  output_product_code: string;
  output_uom: string;
  suggested_pct: number | null;
  sort_order: number;
  notes: string | null;
}

export interface GoodsProcessingInputWithTemplate extends GoodsProcessingInputWithProduct {
  outputs: GoodsProcessingOutputWithProduct[];
  output_template: OutputTemplateRow[];
}

export interface GoodsProcessingDetail extends GoodsProcessingWithRelations {
  inputs: GoodsProcessingInputWithTemplate[];
}

// DTOs
export interface UpdateOutputDto {
  id?: string;
  product_id: string;
  qty_output: number;
  uom: string;
  is_waste: boolean;
  waste_reason?: string | null;
  photo_urls?: string[] | null;
  sort_order?: number;
  // New fields
  condition_status?: ConditionStatus | null;
  actual_qty?: number | null;
  actual_uom?: string | null;
  flagged_for_return?: boolean;
  return_reason?: string | null;
}

export interface UpdateGoodsProcessingDto {
  processing_type?: GoodsProcessingType;
  notes?: string | null;
  inputs: {
    id: string;
    outputs: UpdateOutputDto[];
  }[];
}

export interface RejectDto {
  rejection_reason: string;
}

export interface ResolveReturnDto {
  resolution: "STOCK" | "DISCARD";
}
