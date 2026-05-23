import { UsersRepository } from './users.repository'
import { EmployeeRow, UserDTO } from './users.types'
import { mapToUserDTO } from './users.mapper'

function rowToEmployee(row: Record<string, unknown>): EmployeeRow {
  return {
    employee_id: row.employee_id as string,
    full_name: row.full_name as string,
    job_position: row.job_position as string,
    email: row.email as string,
    user_id: row.user_id as string,
    employee_branches: row.branch_id
      ? [{
          is_primary: row.is_primary as boolean,
          branches: { id: row.branch_id as string, branch_name: row.branch_name as string },
        }]
      : null,
  }
}

function rowToBranchRoleProfile(row: Record<string, unknown> | null | undefined) {
  if (!row?.role_id) return undefined
  return {
    user_id: row.user_id as string | undefined,
    role_id: row.role_id as string,
    perm_roles: row.role_ref_id
      ? {
          id: row.role_ref_id as string,
          name: row.role_name as string,
          description: row.role_description as string,
        }
      : null,
  }
}

export class UsersService {
  private repository = new UsersRepository()

  async getAllUsers(): Promise<UserDTO[]> {
    const rows = await this.repository.getAllUsersWithEmployees()
    return rows.map((row: Record<string, unknown>) =>
      mapToUserDTO(rowToEmployee(row), rowToBranchRoleProfile(row)),
    )
  }

  async getUserByEmployeeId(employeeId: string): Promise<UserDTO | null> {
    const row = await this.repository.getEmployeeWithBranchByEmployeeId(employeeId)
    if (!row) return null
    return mapToUserDTO(rowToEmployee(row), rowToBranchRoleProfile(row))
  }

  /** Role from primary active branch assignment (not global perm_user_profiles). */
  async getUserRoleByEmployeeId(employeeId: string) {
    const userId = await this.repository.getUserIdByEmployeeId(employeeId)
    if (!userId) return null
    return this.getBranchRoleForUser(userId)
  }

  async getBranchRoleForUser(userId: string) {
    const row = await this.repository.getBranchRoleByUserId(userId)
    if (!row?.role_id) return null
    return {
      user_id: userId,
      role_id: row.role_id,
      perm_roles: row.role_ref_id
        ? { id: row.role_ref_id, name: row.role_name, description: row.role_description }
        : null,
    }
  }
}
