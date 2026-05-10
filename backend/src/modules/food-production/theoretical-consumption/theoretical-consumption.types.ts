export interface TheoreticalConsumptionItem {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  theoretical_qty: number
  theoretical_cost: number
}

export interface VarianceItem {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  theoretical_qty: number
  actual_qty: number
  waste_qty: number
  variance_qty: number
  variance_pct: number | null
  severity: 'normal' | 'warning' | 'critical'
}

export interface CoverageItem {
  pos_menu_id: number
  menu_name: string
  menu_code: string
  total_qty_sold: number
  days_sold: number
  priority: 'high' | 'medium' | 'low'
}

export interface CoverageSummary {
  total_menus_sold: number
  menus_with_recipe: number
  menus_without_recipe: number
  coverage_pct: number
  items: CoverageItem[]
}

export interface TheoreticalConsumptionQuery {
  period_start: string
  period_end: string
  branch_id?: string
}

export interface BranchIds {
  branchUuid: string
  branchPosId: number
}

// ── Menu Profitability ──
export interface MenuProfitabilityItem {
  menu_id: string | null
  menu_name: string
  category_name: string | null
  selling_price: number
  estimated_cost: number
  cost_pct: number
  qty_sold: number
  total_revenue: number
  total_cogs: number
  margin: number
  tier: 'A' | 'B' | 'C'
}

export interface MenuProfitabilityRaw {
  menu_id: string | null
  menu_name: string
  category_name: string | null
  selling_price: number
  estimated_cost: number
  cost_pct: number
  qty_sold: number
  total_revenue: number
  total_cogs: number
  margin: number
}

// ── Cost Trend ──
export interface CostTrendItem {
  period: string
  total_revenue: number
  total_cogs: number
  cost_pct: number
  menu_count: number
}

// ── Waste Summary ──
export interface WasteSummaryItem {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  total_used: number
  total_waste: number
  waste_pct: number
  waste_cost: number
  total_used_cost: number
}
