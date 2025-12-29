// =====================================================
// ROLE PERMISSIONS SERVICE
// Responsibility: Role-permission business logic & orchestration
// =====================================================

import { RolePermissionsRepository } from './role-permissions.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { PermissionsCache } from './permissions.cache'
import { logError } from '../../config/logger'
import { OperationalError } from './permissions.errors'
import type { UpdateRolePermissionsDto } from './permissions.types'

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
}
