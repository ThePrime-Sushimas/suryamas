export interface CogsCalculation {
  id: string
  company_id: string
  branch_id: string | null
  calculation_date: string
  period_start: string
  period_end: string
  total_food_cogs: number
  total_beverage_cogs: number
  total_other_cogs: number
  total_cogs: number
  total_revenue: number
  cogs_percentage: number
  unmapped_menu_count: number
  status: 'DRAFT' | 'JOURNALED' | 'VOID'
  superseded_by: string | null
  journal_id: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

export interface CogsCalculationLine {
  id: string
  calculation_id: string
  menu_id: string | null
  menu_name: string
  category_name: string | null
  qty_sold: number
  cost_per_unit: number
  total_cogs: number
  revenue: number
  cogs_percentage: number
  has_recipe: boolean
}

export interface CogsPreviewLine {
  menu_id: string | null
  menu_name: string
  category_name: string | null
  qty_sold: number
  cost_per_unit: number
  total_cogs: number
  revenue: number
  cogs_percentage: number
  has_recipe: boolean
}

export interface CogsPreviewResult {
  period_start: string
  period_end: string
  branch_id: string | null
  summary: {
    total_food_cogs: number
    total_beverage_cogs: number
    total_other_cogs: number
    total_cogs: number
    total_revenue: number
    cogs_percentage: number
    unmapped_menu_count: number
    total_menus_sold: number
  }
  lines: CogsPreviewLine[]
}

export interface CogsCalculateParams {
  period_start: string
  period_end: string
  branch_id?: string | null
  notes?: string | null
}

export interface CogsFinalizeParams extends CogsCalculateParams {
  journal_date?: string
}
