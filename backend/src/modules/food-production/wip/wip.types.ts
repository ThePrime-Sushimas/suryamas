export interface WipItem {
  id: string
  company_id: string
  wip_code: string
  wip_name: string
  uom: string
  yield_qty: number
  estimated_cost: number
  cost_per_unit: number
  notes: string | null
  is_active: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface WipIngredient {
  id: string
  wip_id: string
  product_id: string
  qty: number
  uom: string
  cost_per_unit: number
  line_cost: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface WipIngredientWithProduct extends WipIngredient {
  product_code?: string
  product_name?: string
}

export interface WipItemWithIngredients extends WipItem {
  ingredients: WipIngredientWithProduct[]
}

export interface CreateWipItemDto {
  wip_code: string
  wip_name: string
  uom?: string
  yield_qty?: number
  notes?: string | null
  is_active?: boolean
  created_by?: string
  updated_by?: string
  ingredients?: CreateWipIngredientDto[]
}

export interface UpdateWipItemDto {
  wip_name?: string
  uom?: string
  yield_qty?: number
  notes?: string | null
  is_active?: boolean
  updated_by?: string
  ingredients?: CreateWipIngredientDto[]
}

export interface CreateWipIngredientDto {
  product_id: string
  qty: number
  uom?: string
}

export interface WipPosition {
  position_id: string
  position_code: string
  position_name: string
  department_name: string
}

export interface WipItemWithPositions extends WipItem {
  positions: WipPosition[]
}
