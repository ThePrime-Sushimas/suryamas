// =====================================================
// USERS TYPES
// =====================================================

export type EmployeeBranchRow = {
  is_primary: boolean
  branches: {
    branch_name: string
  } | null
}

export type EmployeeRow = {
  employee_id: string
  full_name: string
  job_position: string | null
  email: string | null
  user_id: string | null
  employee_branches: EmployeeBranchRow[] | null
}

export type UserDTO = {
  employee_id: string
  full_name: string
  job_position: string | null
  email: string | null
  branch: string
  user_id: string | null
  has_account: boolean
  role_id: string | null
  role_name: string | null
  role_description: string | null
}
