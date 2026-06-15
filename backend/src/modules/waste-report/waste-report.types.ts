export type WasteSource =
  | 'GOODS_PROCESSING'
  | 'STOCK_ADJUSTMENT'
  | 'PRODUCTION_ORDER'
  | 'DAILY_OPNAME'

export interface WasteRecord {
  source: WasteSource
  date: Date
  branch_id: string
  branch_name?: string
  item_id: string
  item_name?: string
  qty: number
  unit_cost: number
  total_cost: number
  reason?: string
  reference_id: string
  reference_code?: string
  metadata?: Record<string, unknown>
}

export interface MonthlyOpnameSelisih {
  date: Date
  branch_id: string
  branch_name?: string
  item_id: string
  item_name?: string
  selisih_qty: number
  selisih_value: number
  investigasi_note?: string
  reference_id: string
}

export interface WasteReportFilter {
  branch_ids: string[]
  branch_id?: string
  start_date: Date
  end_date: Date
  item_id?: string
  category_id?: string
  source?: WasteSource
}

export interface WasteReportSummary {
  total_waste_qty: number
  total_waste_cost: number
  breakdown_by_source: Record<WasteSource, { qty: number; cost: number }>
  percentage_of_purchase?: number
}

export interface WasteReportResponse {
  filter: WasteReportFilter
  summary: WasteReportSummary
  records: WasteRecord[]
  monthly_selisih: MonthlyOpnameSelisih[]
}

export interface WasteByItemGroup {
  item_id: string
  item_name?: string
  total_qty: number
  total_cost: number
  record_count: number
  breakdown_by_source: Record<WasteSource, { qty: number; cost: number }>
}

export interface WasteBranchGroup {
  branch_id: string
  branch_name?: string
  total_qty: number
  total_cost: number
  record_count: number
  breakdown_by_source: Record<WasteSource, { qty: number; cost: number }>
  percentage_of_total?: number
}

export interface WasteComparePeriod {
  total_cost: number
  total_qty: number
  record_count: number
  breakdown_by_source: Record<WasteSource, { qty: number; cost: number }>
  percentage_of_purchase?: number
}

export interface WasteCompareResponse {
  period_a: WasteComparePeriod
  period_b: WasteComparePeriod
  diff_cost: number
  diff_cost_pct: number | null
  diff_qty: number
}

export interface WasteBranchSourceRow {
  branch_id: string
  branch_name: string | null
  source: WasteSource
  total_qty: number
  total_cost: number
  record_count: number
}

export const WASTE_SOURCES: WasteSource[] = [
  'GOODS_PROCESSING',
  'STOCK_ADJUSTMENT',
  'PRODUCTION_ORDER',
  'DAILY_OPNAME',
]

export function emptyBreakdownBySource(): Record<WasteSource, { qty: number; cost: number }> {
  return {
    GOODS_PROCESSING: { qty: 0, cost: 0 },
    STOCK_ADJUSTMENT: { qty: 0, cost: 0 },
    PRODUCTION_ORDER: { qty: 0, cost: 0 },
    DAILY_OPNAME: { qty: 0, cost: 0 },
  }
}

export interface WasteQueryContext {
  branchIds: string[]
  startDate: string
  endDate: string
  itemId?: string
  categoryId?: string
}

// ── Variance Summary (Aktual vs Teoretis) ──

export type VarianceSeverity = 'OK' | 'WARNING' | 'CRITICAL'

export interface WasteVarianceSummary {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  category_id?: string
  category_name?: string

  // Dari theoretical-consumption variance
  actual_qty: number
  theoretical_qty: number
  variance_qty: number          // actual - theoretical (positif = over usage)
  variance_pct: number | null   // variance_qty / theoretical_qty × 100
  severity: VarianceSeverity | null

  // Dari waste-report (4 source verified)
  waste_qty: number
  waste_cost: number
  waste_breakdown: Record<WasteSource, { qty: number; cost: number }>

  // Derived
  unexplained_qty: number       // max(0, variance_qty - waste_qty)
  unexplained_pct: number | null
}

export interface WasteVarianceSummaryResponse {
  items: WasteVarianceSummary[]
  totals: {
    total_variance_qty: number
    total_waste_qty: number
    total_unexplained_qty: number
    items_with_unexplained: number
  }
}
