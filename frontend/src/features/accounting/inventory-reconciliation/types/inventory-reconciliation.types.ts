export interface InventoryReconciliationRow {
  branch_id: string
  branch_name: string
  subledger_value: number
  gl_balance: number
  variance: number
  variance_pct: number
}

export interface UnjournaledWasteRow {
  closing_id: string
  closing_date: string
  branch_id: string
  branch_name: string
  position_name: string | null
  waste_line_count: number
  unjournaled_waste_value: number
}

export interface InventoryReconciliationResult {
  reconciliation: InventoryReconciliationRow[]
  unjournaled_waste: UnjournaledWasteRow[]
  unjournaled_shortage: UnjournaledShortageRow[]
  as_of_date: string
  total_subledger: number
  total_gl: number
  total_variance: number
}

export interface UnjournaledShortageRow {
  vcl_id: string
  closing_date: string
  branch_id: string
  branch_name: string
  product_id: string
  resolve_status: string
  deduction_amount: number
}

export interface InventoryReconciliationFilter {
  as_of_date: string
  branch_ids: string[]
}
