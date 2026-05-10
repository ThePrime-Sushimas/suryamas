export interface EmployeePosition {
  id: string
  employee_id: string
  position_id: string
  is_primary: boolean
  assigned_at: string
  assigned_by: string | null
  is_deleted: boolean
  deleted_at: string | null
}

export interface EmployeePositionWithDetails extends EmployeePosition {
  position_code: string
  position_name: string
  department_code: string
  department_name: string
  can_access_all_wip: boolean
}

export interface AssignPositionDto {
  position_id: string
  is_primary?: boolean
  assigned_by?: string
}
