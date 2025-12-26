export interface EmployeeBranch {
  id: string
  employee_id: string
  branch_id: string
  is_primary: boolean
  employee_name: string
  branch_name: string
  branch_code: string
  created_at: string
}

export interface EmployeeBranchListQuery {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface CreateEmployeeBranchDTO {
  employee_id: string
  branch_id: string
  is_primary: boolean
}

export interface UpdateEmployeeBranchDTO {
  is_primary: boolean
}

export interface DomainError {
  code: string
  message: string
  details?: unknown
}
