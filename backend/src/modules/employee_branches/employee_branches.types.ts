export interface EmployeeBranch {
  id: string
  employee_id: string
  branch_id: string
  is_primary: boolean
  created_at: string
}

export interface EmployeeBranchWithDetails extends EmployeeBranch {
  employee_name?: string
  branch_name?: string
  branch_code?: string
}

export interface CreateEmployeeBranchDto {
  employee_id: string
  branch_id: string
  is_primary?: boolean
}

export interface UpdateEmployeeBranchDto {
  is_primary?: boolean
}
