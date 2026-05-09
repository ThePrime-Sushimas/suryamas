export type ProductionOrderStatus = 'DRAFT' | 'COMPLETED' | 'JOURNALED' | 'VOID'
export type CostSource = 'wip_ingredient' | 'average_cost'

export interface ProductionOrder {
  id: string
  company_id: string
  branch_id: string
  order_number: string
  production_date: string
  status: ProductionOrderStatus
  total_material_cost: number
  total_waste_cost: number
  notes: string | null
  completed_by: string | null
  completed_at: string | null
  voided_by: string | null
  voided_at: string | null
  void_reason: string | null
  journal_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface ProductionOrderWithBranch extends ProductionOrder {
  branch_name: string
}

export interface ProductionOrderLine {
  id: string
  production_order_id: string
  wip_id: string
  wip_name: string
  wip_code: string
  planned_batch_qty: number
  actual_batch_qty: number | null
  yield_per_batch: number
  uom: string
  total_yield: number | null
  cost_per_batch: number
  total_cost: number | null
  sort_order: number
  created_at: string
}

export interface ProductionOrderMaterial {
  id: string
  production_order_id: string
  production_line_id: string
  product_id: string
  product_name: string
  product_code: string
  planned_qty: number
  actual_qty: number | null
  total_cost: number | null
  uom: string
  cost_per_unit: number
  cost_source: CostSource
  waste_qty: number
  waste_reason: string | null
  sort_order: number
  created_at: string
}

export interface ProductionOrderWithDetails extends ProductionOrder {
  branch_name: string
  lines: (ProductionOrderLine & { materials: ProductionOrderMaterial[] })[]
}

// DTOs
export interface CreateProductionOrderLineDto {
  wip_id: string
  planned_batch_qty: number
}

export interface CreateProductionOrderDto {
  company_id: string
  branch_id: string
  production_date: string
  notes?: string
  created_by?: string
  lines: CreateProductionOrderLineDto[]
}

export interface CompleteMaterialDto {
  id: string
  actual_qty: number
  waste_qty?: number
  waste_reason?: string
}

export interface CompleteLineDto {
  id: string
  actual_batch_qty: number
  materials: CompleteMaterialDto[]
}

export interface CompleteProductionOrderDto {
  user_id: string
  lines: CompleteLineDto[]
}

export interface VoidProductionOrderDto {
  user_id: string
  reason: string
}

// Report types
export interface MaterialUsageSummary {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  total_used: number
  total_waste: number
  total_cost: number
  total_waste_cost: number
}

export interface DailySummary {
  production_date: string
  branch_id: string
  branch_name: string
  order_count: number
  total_batches: number
  total_cost: number
  total_waste_cost: number
}
