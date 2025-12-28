import { EmployeeBranchWithRelations } from './employee_branches.types'

export function mapEmployeeBranch(row: any): EmployeeBranchWithRelations {
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid employee_branch row: not an object')
  }

  if (typeof row.id !== 'string') {
    throw new Error('Invalid employee_branch row: id missing')
  }

  if (typeof row.employee_id !== 'string') {
    throw new Error('Invalid employee_branch row: employee_id missing')
  }

  if (typeof row.branch_id !== 'string') {
    throw new Error('Invalid employee_branch row: branch_id missing')
  }

  if (typeof row.is_primary !== 'boolean') {
    throw new Error('Invalid employee_branch row: is_primary missing')
  }

  if (typeof row.created_at !== 'string') {
    throw new Error('Invalid employee_branch row: created_at missing')
  }

  // Handle both array and object format from Supabase
  const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees
  const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches

  if (!employee || !employee.full_name) {
    throw new Error('Employee relation missing')
  }

  if (!branch || !branch.branch_name) {
    throw new Error('Branch relation missing')
  }

  return {
    id: row.id,
    employee_id: row.employee_id,
    branch_id: row.branch_id,
    is_primary: row.is_primary,
    created_at: row.created_at,
    employee: {
      full_name: employee.full_name,
      job_position: employee.job_position || null,
      email: employee.email || null,
      mobile_phone: employee.mobile_phone || null,
    },
    branch: {
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
    },
  }
}
