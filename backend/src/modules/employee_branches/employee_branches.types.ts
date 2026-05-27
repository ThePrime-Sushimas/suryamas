// =========================
// DATABASE ENTITY
// =========================
export interface EmployeeBranchEntity {
  id: string
  employee_id: string
  branch_id: string
  role_id: string
  position_id: string | null // NEW: Position at this specific branch
  is_primary: boolean
  approval_limit: number
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
}

// =========================
// REPOSITORY OUTPUT
// =========================
export interface EmployeeBranchWithRelations extends EmployeeBranchEntity {
  employee: { 
    full_name: string
    job_position: string | null
    email: string | null
    mobile_phone: string | null
  }
  branch: { branch_name: string; branch_code: string; company_id: string; company_name?: string; status: string }
  role: { name: string; description: string | null }
  position: { // NEW: Position details
    position_code: string
    position_name: string
    department_code: string
    department_name: string
  } | null
}

// =========================
// SERVICE DTO
// =========================
export interface EmployeeBranchDto {
  id: string
  employee_id: string
  branch_id: string
  role_id: string
  position_id: string | null // NEW
  is_primary: boolean
  approval_limit: number
  status: 'active' | 'inactive' | 'suspended'
  employee_name: string
  job_position: string | null
  email: string | null
  mobile_phone: string | null
  branch_name: string
  branch_code: string
  role_name: string
  position_code: string | null // NEW
  position_name: string | null // NEW
  department_name: string | null // NEW
  created_at: string
}

// =========================
// API RESPONSE
// =========================
export type EmployeeBranchResponse = EmployeeBranchDto

export interface CreateEmployeeBranchData {
  employee_id: string
  branch_id: string
  role_id: string
  position_id?: string | null // NEW: Optional position
  is_primary: boolean
  approval_limit?: number
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateEmployeeBranchData {
  role_id?: string
  position_id?: string | null // NEW: Can update position
  is_primary?: boolean
  approval_limit?: number
  status?: 'active' | 'inactive' | 'suspended'
}

export interface PaginationParams {
  page: number
  limit: number
  search?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMeta
}

// =========================
// MY BRANCHES DTO
// =========================
export interface MyBranchDto {
  branch_id: string
  branch_name: string
  branch_code: string
  company_id: string
  company_name?: string
  employee_id: string
  role_id: string
  role_name: string
  position_id: string | null // NEW
  position_name: string | null // NEW
  department_name: string | null // NEW
  approval_limit: number
  status: 'active' | 'inactive' | 'suspended'
  is_primary: boolean
  branch_status: string
  is_read_only: boolean
}
