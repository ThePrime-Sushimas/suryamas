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

  if (!Array.isArray(row.employees) || !row.employees[0]) {
    throw new Error('Employee relation missing')
  }

  if (!Array.isArray(row.branches) || !row.branches[0]) {
    throw new Error('Branch relation missing')
  }

  return {
    id: row.id,
    employee_id: row.employee_id,
    branch_id: row.branch_id,
    is_primary: row.is_primary,
    created_at: row.created_at,
    employee: {
      full_name: row.employees[0].full_name,
    },
    branch: {
      branch_name: row.branches[0].branch_name,
      branch_code: row.branches[0].branch_code,
    },
  }
}
