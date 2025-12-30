// =====================================================
// ROLE PERMISSIONS SERVICE
// Responsibility: Role-permission business logic & orchestration
// =====================================================

import { RolePermissionsRepository } from './role-permissions.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { PermissionsCache } from './permissions.cache'
import { logError } from '../../config/logger'
import { OperationalError } from './permissions.errors'
import type { UpdateRolePermissionsDto, PermissionMatrix } from './permissions.types'

export class RolePermissionsService {
  private repository: RolePermissionsRepository

  constructor() {
    this.repository = new RolePermissionsRepository()
  }

  async getByRoleId(roleId: string) {
    return await this.repository.getByRoleId(roleId)
  }

  async update(
    roleId: string,
    moduleId: string,
    permissions: UpdateRolePermissionsDto,
    changedBy?: string
  ) {
    try {
      const result = await CorePermissionService.updateRolePermissions(
        roleId,
        moduleId,
        permissions,
        changedBy
      )
      PermissionsCache.invalidateRole(roleId)
      PermissionsCache.invalidateRole('all_roles')
      return result
    } catch (error: any) {
      logError('Failed to update role permission', { error: error.message })
      if (error instanceof OperationalError) throw error
      throw new OperationalError(error.message || 'Failed to update role permission', 500)
    }
  }

  async bulkUpdate(
    roleId: string,
    updates: Array<{ moduleId: string; permissions: UpdateRolePermissionsDto }>,
    changedBy?: string
  ) {
    await CorePermissionService.bulkUpdateRolePermissions(roleId, updates, changedBy)
    PermissionsCache.invalidateRole(roleId)
    PermissionsCache.invalidateRole('all_roles')
  }

  async getMyPermissions(userId: string): Promise<PermissionMatrix> {
    if (!userId) throw new OperationalError('User ID required', 400)
    
    try {
      // Get employee by user_id
      const employee = await this.repository.getEmployeeByUserId(userId)
      if (!employee) throw new OperationalError('Employee not found', 404)

      // Get employee's role from employee_branches (use first active branch)
      const roleId = await this.repository.getEmployeeRoleId(employee.id)
      if (!roleId) return {} // No role assigned, return empty permissions

      // Get permissions for that role
      const permissions = await this.repository.getByRoleId(roleId)
      
      // Transform to frontend format
      const result: PermissionMatrix = {}
      permissions.forEach(perm => {
        result[perm.module_name] = {
          view: perm.can_view,
          insert: perm.can_insert,
          update: perm.can_update,
          delete: perm.can_delete,
          approve: perm.can_approve,
          release: perm.can_release,
        }
      })
      
      return result
    } catch (error: any) {
      logError('Failed to get user permissions', { error: error.message, userId })
      if (error instanceof OperationalError) throw error
      throw new OperationalError('Failed to get user permissions', 500)
    }
  }
}
