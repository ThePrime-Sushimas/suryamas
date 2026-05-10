export interface Department {
  id: string
  company_id: string
  department_code: string
  department_name: string
  sort_order: number
  is_active: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface DepartmentWithCount extends Department {
  position_count: number
}

export interface CreateDepartmentDto {
  department_code: string
  department_name: string
  sort_order?: number
  created_by?: string
}

export interface UpdateDepartmentDto {
  department_name?: string
  sort_order?: number
  is_active?: boolean
  updated_by?: string
}
