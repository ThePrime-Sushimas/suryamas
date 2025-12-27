// =====================================================
// USERS SERVICE
// =====================================================

import { UsersRepository } from './users.repository'
import { supabase } from '../../config/supabase'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { logInfo, logError } from '../../config/logger'
import { EmployeeRow, UserDTO } from './users.types'
import { mapToUserDTO } from './users.mapper'

export class UsersService {
  private repository: UsersRepository

  constructor() {
    this.repository = new UsersRepository()
  }

  async getAllUsers(): Promise<UserDTO[]> {
    const { data: employees } = await supabase
      .from('employees')
      .select('employee_id, full_name, job_position, email, user_id, employee_branches(is_primary, branches(branch_name))')

    const { data: profiles } = await supabase
      .from('perm_user_profiles')
      .select('user_id, role_id, perm_roles(id, name, description)')

    return ((employees as EmployeeRow[] | null) || []).map(emp =>
      mapToUserDTO(
        emp,
        profiles?.find(p => p.user_id === emp.user_id)
      )
    )
  }

  async getUserById(employeeId: string): Promise<UserDTO | null> {
    const { data: employee } = await supabase
      .from('employees')
      .select('employee_id, full_name, job_position, email, user_id, employee_branches(is_primary, branches(branch_name))')
      .eq('employee_id', employeeId)
      .single()

    if (!employee) return null

    const { data: profile } = await supabase
      .from('perm_user_profiles')
      .select('user_id, role_id, perm_roles(id, name, description)')
      .eq('user_id', employee.user_id)
      .single()

    return mapToUserDTO(employee as EmployeeRow, profile)
  }

  async getUserRole(userId: string) {
    return await this.repository.getUserRole(userId)
  }

  async assignRole(userId: string, roleId: string, changedBy?: string) {
    try {
      const result = await this.repository.assignRole(userId, roleId)
      
      await supabase.from('perm_cache').delete().eq('user_id', userId)
      await CorePermissionService.invalidateAllCache()
      
      logInfo('User role assigned', { userId, roleId, changedBy })
      return result
    } catch (error: any) {
      logError('Failed to assign role', { error: error.message })
      throw error
    }
  }

  async removeRole(userId: string, changedBy?: string) {
    try {
      await this.repository.removeRole(userId)
      
      await supabase.from('perm_cache').delete().eq('user_id', userId)
      await CorePermissionService.invalidateAllCache()
      
      logInfo('User role removed', { userId, changedBy })
      return true
    } catch (error: any) {
      logError('Failed to remove role', { error: error.message })
      throw error
    }
  }

  async assignRoleByEmployeeId(employeeId: string, roleId: string, changedBy?: string) {
    const { data: employee } = await supabase.from('employees').select('user_id, full_name').eq('employee_id', employeeId).single()
    if (!employee?.user_id) {
      throw new Error(`Employee ${employee?.full_name || employeeId} has not registered yet. Please register first.`)
    }
    return this.assignRole(employee.user_id, roleId, changedBy)
  }

  async removeRoleByEmployeeId(employeeId: string, changedBy?: string) {
    const { data: employee } = await supabase.from('employees').select('user_id').eq('employee_id', employeeId).single()
    if (!employee?.user_id) throw new Error('Employee has no user account')
    return this.removeRole(employee.user_id, changedBy)
  }
}
