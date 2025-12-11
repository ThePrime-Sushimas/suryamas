// =====================================================
// USERS SERVICE
// =====================================================

import { UsersRepository } from './users.repository'
import { supabase } from '../../config/supabase'
import { logInfo, logError } from '../../config/logger'

export class UsersService {
  private repository: UsersRepository

  constructor() {
    this.repository = new UsersRepository()
  }

  async getAllUsers() {
    const { data: employees } = await supabase.from('employees').select('employee_id, full_name, job_position, email, user_id, branch_name')
    const { data: profiles } = await supabase.from('perm_user_profiles').select('user_id, role_id, perm_roles(id, name, description)')
    
    const normalizeBranch = (branch: string | null) => {
      if (!branch) return 'No Branch'
      return branch.charAt(0).toUpperCase() + branch.slice(1).toLowerCase()
    }
    
    return (employees || []).map(employee => {
      const profile = profiles?.find(p => p.user_id === employee.user_id)
      return {
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        job_position: employee.job_position,
        email: employee.email,
        branch: normalizeBranch(employee.branch_name),
        user_id: employee.user_id,
        has_account: !!employee.user_id,
        role_id: profile?.role_id || null,
        role_name: (profile as any)?.perm_roles?.name || null,
        role_description: (profile as any)?.perm_roles?.description || null
      }
    })
  }

  async getUserRole(userId: string) {
    return await this.repository.getUserRole(userId)
  }

  async assignRole(userId: string, roleId: string, changedBy?: string) {
    try {
      const result = await this.repository.assignRole(userId, roleId)
      
      // Invalidate cache
      await supabase.from('perm_cache').delete().eq('user_id', userId)
      
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
      
      // Invalidate cache
      await supabase.from('perm_cache').delete().eq('user_id', userId)
      
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
