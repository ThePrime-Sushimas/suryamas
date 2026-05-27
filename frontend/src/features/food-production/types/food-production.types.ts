// ── Menu Categories ──
export interface MenuCategory {
  id: string
  category_name: string
  category_code: string
  sales_coa_id: string | null
  sales_coa_code?: string | null
  sales_coa_name?: string | null
  cogs_coa_id: string | null
  cogs_coa_code?: string | null
  cogs_coa_name?: string | null
  sort_order: number
  is_active: boolean
}

// ── Menu Groups ──
export interface MenuGroup {
  id: string
  category_id: string
  category_name?: string
  category_code?: string
  group_name: string
  group_code: string
  sort_order: number
  is_active: boolean
}

// ── Menus ──
export interface Menu {
  id: string
  pos_menu_id: number | null
  category_id: string
  category_name?: string
  category_code?: string
  group_id: string | null
  group_name?: string | null
  group_code?: string | null
  menu_code: string
  menu_name: string
  selling_price: number
  estimated_cost: number
  cost_percentage: number
  has_recipe: boolean
  is_active: boolean
  sync_enabled: boolean
  last_synced_at: string | null
}

// ── WIP ──
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
}

export interface WipIngredient {
  id: string
  wip_id: string
  product_id: string
  product_code?: string
  product_name?: string
  qty: number
  uom: string
  cost_per_unit: number
  line_cost: number
  sort_order: number
}

export interface WipItemWithIngredients extends WipItem {
  ingredients: WipIngredient[]
}

// ── Recipes ──
export interface RecipeLine {
  id?: string
  menu_id?: string
  product_id: string | null
  wip_id: string | null
  ingredient_name?: string
  ingredient_code?: string
  ingredient_type?: 'product' | 'wip'
  qty: number
  uom: string
  cost_per_unit: number
  line_cost: number
  sort_order: number
}

export interface MenuRecipe {
  menu_id: string
  menu_name: string
  menu_code: string
  estimated_cost: number
  selling_price: number
  cost_percentage: number
  has_recipe: boolean
  lines: RecipeLine[]
}

// ── COGS ──
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

export interface CogsSummary {
  total_food_cogs: number
  total_beverage_cogs: number
  total_other_cogs: number
  total_cogs: number
  total_revenue: number
  cogs_percentage: number
  unmapped_menu_count: number
  total_menus_sold: number
}

export interface CogsPreviewResult {
  period_start: string
  period_end: string
  branch_id: string | null
  summary: CogsSummary
  lines: CogsPreviewLine[]
}

export interface CogsCalculation {
  id: string
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
  journal_id: string | null
  notes: string | null
  created_at: string
}

export interface SyncResult {
  inserted: number
  updated: number
  skipped: number
}

// ── Shared ──
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ── Theoretical Consumption ──
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

export interface TheoreticalConsumptionResult {
  items: TheoreticalConsumptionItem[]
  coverage: { total: number; withRecipe: number; pct: number }
}

export interface VarianceResult {
  items: VarianceItem[]
  hasActualData: boolean
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

export interface WasteSummaryResult {
  items: WasteSummaryItem[]
  totals: { total_waste_cost: number; total_used_cost: number; overall_waste_pct: number }
}
