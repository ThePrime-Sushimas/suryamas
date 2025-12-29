// =========================
// DATABASE ENTITY
// =========================
export interface EmployeeBranchEntity {
  id: string
  employee_id: string
  branch_id: string
  role_id: string
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
  branch: { branch_name: string; branch_code: string; company_id: string }
  role: { name: string; description: string | null }
}

// =========================
// SERVICE DTO
// =========================
export interface EmployeeBranchDto {
  id: string
  employee_id: string
  branch_id: string
  role_id: string
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
  is_primary: boolean
  approval_limit?: number
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateEmployeeBranchData {
  role_id?: string
  is_primary?: boolean
  approval_limit?: number
  status?: 'active' | 'inactive' | 'suspended'
}

export interface PaginationParams {
  page: number
  limit: number
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
