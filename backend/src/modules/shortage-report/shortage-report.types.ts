export type ShortageResolveStatus =
  | 'UNRESOLVED'
  | 'RESOLVED'
  | 'CONVERTED_TO_WASTE'

export type ShortageResolveAction = 'RESOLVE' | 'CONVERT_TO_WASTE'

export type ShortageDeductionMode = 'INDIVIDUAL' | 'DIVISION'

export type ShortageAllocationMode = 'INDIVIDUAL' | 'DIVISION'

export type ShortageSourceType = 'DAILY_OPNAME' | 'MONTHLY_OPNAME'

export interface ShortageRecord {
  id: string
  source_type: ShortageSourceType
  date: string
  branch_id: string
  branch_name?: string
  position_id?: string
  position_name?: string
  department_id?: string
  department_name?: string
  item_id: string
  item_name?: string
  category_id?: string
  category_name?: string
  qty: number
  unit_cost: number
  total_cost: number
  closing_id: string | null
  monthly_opname_id?: string | null
  reference_code?: string
  resolve_status: ShortageResolveStatus
  resolved_at?: string
  resolved_by_name?: string
  resolved_notes?: string
  converted_sa_id?: string
  deducted_employee_id?: string
  deducted_employee_name?: string
  shortage_assigned_to?: string
  shortage_assigned_to_name?: string
  shortage_note?: string
  deduction_amount?: number
  deduction_notes?: string
  deduction_paid_at?: string
  deduction_mode?: ShortageDeductionMode
  division_alloc_count?: number
  division_all_paid?: boolean
}

export interface ShortageQueryContext {
  branchIds: string[]
  startDate: string
  endDate: string
  branchId?: string
  positionId?: string
  itemId?: string
  categoryId?: string
  resolveStatus?: ShortageResolveStatus
  vclId?: string
}

export interface ShortageReportFilter {
  branch_ids: string[]
  branch_id?: string
  position_id?: string
  start_date: Date
  end_date: Date
  item_id?: string
  category_id?: string
  resolve_status?: ShortageResolveStatus
}

export interface ShortageReportSummary {
  total_shortage_qty: number
  total_shortage_cost: number
  unresolved_count: number
  unresolved_cost: number
  resolved_count: number
  resolved_cost: number
  converted_to_waste_count: number
  converted_to_waste_cost: number
  total_deduction_amount: number
  pending_deduction_cost: number
}

export interface ShortageReportResponse {
  summary: ShortageReportSummary
  records: ShortageRecord[]
}

export interface ShortageByItemGroup {
  item_id: string
  item_name?: string
  category_name?: string
  total_qty: number
  total_cost: number
  record_count: number
  unresolved_count: number
  unresolved_cost: number
}

export interface ShortageByEmployeeGroup {
  employee_id: string
  employee_name: string
  branch_name?: string
  total_deduction_amount: number
  shortage_count: number
  paid_count: number
  detail: {
    id: string
    allocation_id?: string
    date: string
    item_name?: string
    qty: number
    total_cost: number
    deduction_amount: number
    notes?: string
    deduction_paid_at?: string
    resolve_status: ShortageResolveStatus
    is_provisional: boolean
    deduction_mode?: ShortageDeductionMode
    department_name?: string
  }[]
}

export interface ShortageByDepartmentGroup {
  department_id: string
  department_name: string
  branch_name?: string
  total_deduction_amount: number
  shortage_count: number
  paid_count: number
  employee_count: number
  detail: {
    id: string
    allocation_id?: string
    vcl_id: string
    date: string
    item_name?: string
    employee_id?: string
    employee_name?: string
    qty: number
    total_cost: number
    deduction_amount: number
    notes?: string
    deduction_paid_at?: string
    resolve_status: ShortageResolveStatus
    is_provisional: boolean
  }[]
}

export interface DepartmentEmployeePreview {
  id: string
  full_name: string
}

export interface ShortageResolvePayload {
  vcl_ids: string[]
  action: ShortageResolveAction
  resolved_notes?: string | null
  allocation_mode?: ShortageAllocationMode
  department_id?: string | null
  deducted_employee_id?: string | null
  deduction_amount?: number | null
  deduction_notes?: string | null
}

export interface ShortageResolveResult {
  success: boolean
  journal_pending?: boolean
  converted_sa_id?: string
}

export interface ShortageRowForResolve {
  id: string
  source_type: ShortageSourceType
  closing_id: string | null
  monthly_opname_id: string | null
  branch_id: string
  company_id: string
  warehouse_id: string
  closing_date: string
  position_id: string | null
  position_name: string | null
  product_id: string
  cost_per_unit: number
  abs_qty: number
  shortage_assigned_to: string | null
  shortage_note: string | null
  total_cost: number
  department_id: string | null
}
