// =====================================================
// USERS MAPPER
// =====================================================

import { EmployeeRow, EmployeeBranchRow, UserDTO } from './users.types'

function extractPrimaryBranch(branches: EmployeeBranchRow[] | null): string {
  if (!branches || branches.length === 0) return '-'
  
  const primary = branches.find(b => b.is_primary)
  if (primary && primary.branches) {
    return primary.branches.branch_name
  }
  
  // If no primary branch found, return the first available branch
  if (branches[0]?.branches) {
    return branches[0].branches.branch_name
  }
  
  return '-'
}

export function mapToUserDTO(employee: EmployeeRow, profile?: any): UserDTO {
  return {
    employee_id: employee.employee_id,
    full_name: employee.full_name,
    job_position: employee.job_position,
    email: employee.email,
    branch: extractPrimaryBranch(employee.employee_branches),
    user_id: employee.user_id,
    has_account: Boolean(employee.user_id),
    role_id: profile?.role_id ?? null,
    role_name: profile?.perm_roles?.name ?? null,
    role_description: profile?.perm_roles?.description ?? null,
  }
}
