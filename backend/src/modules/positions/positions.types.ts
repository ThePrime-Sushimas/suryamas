export interface Position {
  id: string
  company_id: string
  department_id: string
  position_code: string
  position_name: string
  role_id: string | null
  can_access_all_wip: boolean
  sort_order: number
  is_active: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PositionWithDepartment extends Position {
  department_code: string
  department_name: string
  employee_count: number
}

export interface CreatePositionDto {
  department_id: string
  position_code: string
  position_name: string
  role_id?: string
  can_access_all_wip?: boolean
  sort_order?: number
  created_by?: string
}

export interface UpdatePositionDto {
  department_id?: string
  position_name?: string
  role_id?: string
  can_access_all_wip?: boolean
  sort_order?: number
  is_active?: boolean
  updated_by?: string
}
