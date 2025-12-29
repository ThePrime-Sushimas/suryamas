// =====================================================
// ROLE PERMISSIONS CONTROLLER
// Responsibility: HTTP handling for role-permissions only
// =====================================================

import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { RolePermissionsService } from './role-permissions.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class RolePermissionsController {
  private service: RolePermissionsService

  constructor() {
    this.service = new RolePermissionsService()
  }

  getByRoleId = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roleId } = req.params
      const permissions = await this.service.getByRoleId(roleId)
      sendSuccess(res, permissions, 'Role permissions retrieved successfully')
    } catch (error: any) {
      logError('Get role permissions failed', { error: error.message })
      sendError(res, 'Failed to retrieve role permissions', 500)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roleId, moduleId } = req.params
      const permission = await this.service.update(
        roleId,
        moduleId,
        req.body,
        req.user?.id
      )
      sendSuccess(res, permission, 'Role permission updated successfully')
    } catch (error: any) {
      logError('Update role permission failed', { error: error.message })
      sendError(res, 'Failed to update role permission', 500)
    }
  }

  bulkUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roleId } = req.params
      const { updates } = req.body
      await this.service.bulkUpdate(roleId, updates, req.user?.id)
      sendSuccess(res, null, 'Role permissions updated successfully')
    } catch (error: any) {
      logError('Bulk update role permissions failed', { error: error.message })
      sendError(res, 'Failed to update role permissions', 500)
    }
  }
}
