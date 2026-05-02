import { EmployeeBranchWithRelations } from './employee_branches.types'

export function mapEmployeeBranch(row: any): EmployeeBranchWithRelations {
  if (!row?.id || !row?.employee_id || !row?.branch_id || !row?.role_id) {
    throw new Error('Invalid employee_branch row: missing required fields')
  }

  const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees
  const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches
  const role = Array.isArray(row.perm_roles) ? row.perm_roles[0] : row.perm_roles

  if (!employee?.full_name) throw new Error('Employee relation missing')
  if (!branch?.branch_name) throw new Error('Branch relation missing')
  if (!role?.name) throw new Error('Role relation missing')

  return {
    id: row.id,
    employee_id: row.employee_id,
    branch_id: row.branch_id,
    role_id: row.role_id,
    is_primary: Boolean(row.is_primary),
    approval_limit: Number(row.approval_limit ?? 0),
    status: (row.status || 'active') as 'active' | 'inactive' | 'suspended',
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
    employee: {
      full_name: employee.full_name,
      job_position: employee.job_position || null,
      email: employee.email || null,
      mobile_phone: employee.mobile_phone || null,
    },
    branch: {
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      company_id: branch.company_id,
      status: branch.status || 'active',
    },
    role: {
      name: role.name,
      description: role.description || null,
    },
  }
}
