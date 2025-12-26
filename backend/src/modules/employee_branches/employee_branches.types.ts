// =========================
// DATABASE ENTITY
// =========================
export interface EmployeeBranchEntity {
  id: string
  employee_id: string
  branch_id: string
  is_primary: boolean
  created_at: string
}

// =========================
// REPOSITORY OUTPUT
// =========================
export interface EmployeeBranchWithRelations extends EmployeeBranchEntity {
  employee: { full_name: string }
  branch: { branch_name: string; branch_code: string }
}

// =========================
// SERVICE DTO
// =========================
export interface EmployeeBranchDto {
  id: string
  employee_id: string
  branch_id: string
  is_primary: boolean
  employee_name: string
  branch_name: string
  branch_code: string
  created_at: string
}

// =========================
// API RESPONSE
// =========================
export type EmployeeBranchResponse = EmployeeBranchDto

export interface CreateEmployeeBranchData {
  employee_id: string
  branch_id: string
  is_primary: boolean
}

export interface UpdateEmployeeBranchData {
  is_primary: boolean
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
