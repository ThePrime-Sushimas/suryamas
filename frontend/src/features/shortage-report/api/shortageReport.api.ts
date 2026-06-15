import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export type ShortageResolveStatus = 'UNRESOLVED' | 'RESOLVED' | 'CONVERTED_TO_WASTE'
export type ShortageSourceType = 'DAILY_OPNAME' | 'MONTHLY_OPNAME'

export interface ShortageRecord {
  id: string
  source_type: ShortageSourceType
  date: string
  branch_id: string
  branch_name?: string
  position_id?: string
  position_name?: string
  item_id: string
  item_name?: string
  category_id?: string
  category_name?: string
  qty: number
  unit_cost: number
  total_cost: number
  closing_id: string | null
  monthly_opname_id?: string | null
  department_id?: string
  department_name?: string
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
  deduction_mode?: 'INDIVIDUAL' | 'DIVISION'
  division_alloc_count?: number
  division_all_paid?: boolean
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
    deduction_mode?: 'INDIVIDUAL' | 'DIVISION'
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

export interface ShortageReportParams {
  start_date: string
  end_date: string
  branch_id?: string
  position_id?: string
  category_id?: string
  item_id?: string
  resolve_status?: ShortageResolveStatus
}

export interface ShortageResolvePayload {
  vcl_ids: string[]
  action: 'RESOLVE' | 'CONVERT_TO_WASTE'
  allocation_mode?: 'INDIVIDUAL' | 'DIVISION'
  department_id?: string
  resolved_notes?: string
  deducted_employee_id?: string
  deduction_amount?: number
  deduction_notes?: string
}

export interface ShortageResolveResult {
  success: boolean
  journal_pending?: boolean
  converted_sa_id?: string
}

export const shortageReportKeys = {
  report: (p: ShortageReportParams) => ['shortage-report', p] as const,
  byItem: (p: ShortageReportParams) => ['shortage-report-by-item', p] as const,
  byEmployee: (p: Pick<ShortageReportParams, 'start_date' | 'end_date' | 'branch_id'>) =>
    ['shortage-report-by-employee', p] as const,
  byDepartment: (p: Pick<ShortageReportParams, 'start_date' | 'end_date' | 'branch_id'>) =>
    ['shortage-report-by-department', p] as const,
  departmentEmployees: (branchId: string, departmentId: string) =>
    ['shortage-department-employees', branchId, departmentId] as const,
  summary: (p: ShortageReportParams) => ['shortage-summary', p] as const,
}

export function useShortageReport(params: ShortageReportParams, enabled = true) {
  return useQuery({
    queryKey: shortageReportKeys.report(params),
    queryFn: async () => {
      const { data } = await api.get('/shortage-report', { params })
      return data.data as ShortageReportResponse
    },
    enabled,
  })
}

export function useShortageReportByItem(params: ShortageReportParams, enabled = true) {
  return useQuery({
    queryKey: shortageReportKeys.byItem(params),
    queryFn: async () => {
      const { data } = await api.get('/shortage-report/by-item', { params })
      return data.data as ShortageByItemGroup[]
    },
    enabled,
  })
}

export function useShortageReportByEmployee(
  params: Pick<ShortageReportParams, 'start_date' | 'end_date' | 'branch_id'>,
  enabled = true,
) {
  return useQuery({
    queryKey: shortageReportKeys.byEmployee(params),
    queryFn: async () => {
      const { data } = await api.get('/shortage-report/by-employee', { params })
      return data.data as ShortageByEmployeeGroup[]
    },
    enabled,
  })
}

export function useShortageReportByDepartment(
  params: Pick<ShortageReportParams, 'start_date' | 'end_date' | 'branch_id'>,
  enabled = true,
) {
  return useQuery({
    queryKey: shortageReportKeys.byDepartment(params),
    queryFn: async () => {
      const { data } = await api.get('/shortage-report/by-department', { params })
      return data.data as ShortageByDepartmentGroup[]
    },
    enabled,
  })
}

export function useDepartmentEmployees(branchId: string, departmentId: string, enabled = true) {
  return useQuery({
    queryKey: shortageReportKeys.departmentEmployees(branchId, departmentId),
    queryFn: async () => {
      const { data } = await api.get('/shortage-report/department-employees', {
        params: { branch_id: branchId, department_id: departmentId },
      })
      return data.data as DepartmentEmployeePreview[]
    },
    enabled: enabled && !!branchId && !!departmentId,
  })
}

export function useShortageSummary(params: ShortageReportParams, enabled = true) {
  return useQuery({
    queryKey: shortageReportKeys.summary(params),
    queryFn: async () => {
      const { data } = await api.get('/shortage-report', {
        params: { ...params, summary_only: 'true' },
      })
      return data.data.summary as ShortageReportSummary
    },
    enabled,
  })
}

export function useResolveShortage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ShortageResolvePayload) => {
      const { data } = await api.post('/shortage-report/resolve', payload)
      return data.data as ShortageResolveResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shortage-report'] })
      qc.invalidateQueries({ queryKey: ['shortage-summary'] })
      qc.invalidateQueries({ queryKey: ['shortage-report-by-employee'] })
      qc.invalidateQueries({ queryKey: ['shortage-report-by-department'] })
      qc.invalidateQueries({ queryKey: ['waste-report'] })
    },
  })
}

export function useMarkDeductionPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { data } = await api.patch(`/shortage-report/${id}/deduction-paid`, { paid })
      return data.data as ShortageRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shortage-report'] })
      qc.invalidateQueries({ queryKey: ['shortage-report-by-employee'] })
      qc.invalidateQueries({ queryKey: ['shortage-report-by-department'] })
    },
  })
}
