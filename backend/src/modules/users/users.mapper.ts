// =====================================================
// USERS MAPPER
// =====================================================

import { EmployeeRow, EmployeeBranchRow, UserDTO } from './users.types'

function extractPrimaryBranch(branches: EmployeeBranchRow[] | null): string {
  if (!branches) return '-'
  const primary = branches.find(b => b.is_primary)
  return primary?.branches?.[0]?.branch_name ?? '-'
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
