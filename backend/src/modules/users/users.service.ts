import { UsersRepository } from './users.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { logInfo, logError } from '../../config/logger'
import { EmployeeRow, UserDTO } from './users.types'
import { mapToUserDTO } from './users.mapper'
import { AuditService } from '../monitoring/monitoring.service'

export class UsersService {
  private repository: UsersRepository

  constructor() {
    this.repository = new UsersRepository()
  }

  async getAllUsers(): Promise<UserDTO[]> {
    const { employees, profiles } = await this.repository.getAllUsersWithEmployees()

    return employees.map((emp: Record<string, unknown>) => {
      const transformedEmp: EmployeeRow = {
        employee_id: emp.employee_id as string,
        full_name: emp.full_name as string,
        job_position: emp.job_position as string,
        email: emp.email as string,
        user_id: emp.user_id as string,
        employee_branches: emp.branch_id ? [{ is_primary: emp.is_primary as boolean, branches: { id: emp.branch_id as string, branch_name: emp.branch_name as string } }] : null,
      }
      const profile = profiles.find((p: { user_id: string }) => p.user_id === emp.user_id)
      const mappedProfile = profile ? {
        user_id: profile.user_id,
        role_id: profile.role_id,
        perm_roles: profile.role_ref_id ? { id: profile.role_ref_id, name: profile.role_name, description: profile.role_description } : null,
      } : undefined
      return mapToUserDTO(transformedEmp, mappedProfile)
    })
  }

  async getUserByEmployeeId(employeeId: string): Promise<UserDTO | null> {
    const emp = await this.repository.getEmployeeWithBranchByEmployeeId(employeeId)
    if (!emp) return null

    let mappedProfile
    if (emp.user_id) {
      const profile = await this.repository.getProfileByUserId(emp.user_id)
      if (profile) {
        mappedProfile = {
          user_id: profile.user_id,
          role_id: profile.role_id,
          perm_roles: profile.role_ref_id ? { id: profile.role_ref_id, name: profile.role_name, description: profile.role_description } : null,
        }
      }
    }

    const transformedEmp: EmployeeRow = {
      employee_id: emp.employee_id,
      full_name: emp.full_name,
      job_position: emp.job_position,
      email: emp.email,
      user_id: emp.user_id,
      employee_branches: emp.branch_id ? [{ is_primary: emp.is_primary, branches: { id: emp.branch_id, branch_name: emp.branch_name } }] : null,
    }

    return mapToUserDTO(transformedEmp, mappedProfile)
  }

  async getUserRoleByEmployeeId(employeeId: string) {
    const userId = await this.repository.getUserIdByEmployeeId(employeeId)
    if (!userId) return null
    return await this.repository.getUserRole(userId)
  }

  async getUserRole(userId: string) {
    return await this.repository.getUserRole(userId)
  }

  async assignRole(userId: string, roleId: string, changedBy?: string) {
    try {
      const result = await this.repository.assignRole(userId, roleId)
      await this.repository.invalidatePermCache(userId)
      await CorePermissionService.invalidateAllCache()

      if (changedBy) {
        await AuditService.log('UPDATE', 'user_role', userId, changedBy, { role_id: null }, { role_id: roleId })
      }
      logInfo('User role assigned', { userId, roleId, changedBy })
      return result
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Failed to assign role', { error: msg })
      throw error
    }
  }

  async removeRole(userId: string, changedBy?: string) {
    try {
      await this.repository.removeRole(userId)
      await this.repository.invalidatePermCache(userId)
      await CorePermissionService.invalidateAllCache()

      if (changedBy) {
        await AuditService.log('UPDATE', 'user_role', userId, changedBy, { role_id: 'existing' }, { role_id: null })
      }
      logInfo('User role removed', { userId, changedBy })
      return true
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Failed to remove role', { error: msg })
      throw error
    }
  }

  async assignRoleByEmployeeId(employeeId: string, roleId: string, changedBy?: string) {
    const emp = await this.repository.getEmployeeUserIdByEmployeeId(employeeId)
    if (!emp?.user_id) {
      throw new Error(`Employee ${emp?.full_name || employeeId} has not registered yet. Please register first.`)
    }
    return this.assignRole(emp.user_id, roleId, changedBy)
  }

  async removeRoleByEmployeeId(employeeId: string, changedBy?: string) {
    const userId = await this.repository.getUserIdByEmployeeId(employeeId)
    if (!userId) throw new Error('This employee does not have a user account')
    return this.removeRole(userId, changedBy)
  }
}
