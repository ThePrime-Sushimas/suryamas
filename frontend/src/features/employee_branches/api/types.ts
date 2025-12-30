export type BranchAssignmentStatus = 'active' | 'inactive' | 'suspended'

export interface EmployeeBranch {
  id: string
  employee_id: string
  branch_id: string
  role_id: string
  is_primary: boolean
  approval_limit: number
  status: BranchAssignmentStatus
  employee_name: string
  branch_name: string
  branch_code: string
  role_name: string
  created_at: string
}

export interface EmployeeBranchListQuery {
  page?: number
  limit?: number
  search?: string
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
  role_id: string
  is_primary: boolean
  approval_limit: number
  status: BranchAssignmentStatus
}

export interface UpdateEmployeeBranchDTO {
  role_id?: string
  is_primary?: boolean
  approval_limit?: number
  status?: BranchAssignmentStatus
}

export interface Role {
  id: string
  name: string
  description: string | null
}

export interface BranchOption {
  id: string
  branch_name: string
  branch_code: string
}

export interface DomainError {
  code: string
  message: string
  details?: unknown
}
