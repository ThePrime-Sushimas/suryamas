// =====================================================
// ROLE PERMISSIONS CONTROLLER
// Responsibility: HTTP handling for role-permissions only
// =====================================================

import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { RolePermissionsService } from './role-permissions.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  updateRolePermissionSchema,
  bulkUpdateRolePermissionsSchema,
} from './permissions.schema'

type UpdateRolePermissionReq = ValidatedAuthRequest<typeof updateRolePermissionSchema>
type BulkUpdateRolePermissionsReq = ValidatedAuthRequest<typeof bulkUpdateRolePermissionsSchema>

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

  update = withValidated(async (req: UpdateRolePermissionReq, res: Response) => {
    try {
      const { roleId, moduleId } = req.validated.params
      const permission = await this.service.update(
        roleId,
        moduleId,
        req.validated.body,
        req.user?.id
      )
      sendSuccess(res, permission, 'Role permission updated successfully')
    } catch (error: any) {
      logError('Update role permission failed', { error: error.message })
      sendError(res, 'Failed to update role permission', 500)
    }
  })

  bulkUpdate = withValidated(async (req: BulkUpdateRolePermissionsReq, res: Response) => {
    try {
      const { roleId } = req.validated.params
      const updates = req.validated.body.map(item => ({
        moduleId: item.module_id,
        permissions: {
          can_view: item.can_view,
          can_insert: item.can_insert,
          can_update: item.can_update,
          can_delete: item.can_delete,
        }
      }))
      await this.service.bulkUpdate(roleId, updates, req.user?.id)
      sendSuccess(res, null, 'Role permissions updated successfully')
    } catch (error: any) {
      logError('Bulk update role permissions failed', { error: error.message })
      sendError(res, 'Failed to update role permissions', 500)
    }
  })
}
