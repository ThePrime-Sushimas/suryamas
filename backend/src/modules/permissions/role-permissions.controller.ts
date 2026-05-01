import { Request, Response } from 'express'
import { RolePermissionsService } from './role-permissions.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  rolePermissionsSchema,
  updateRolePermissionSchema,
  bulkUpdateRolePermissionsSchema,
} from './permissions.schema'

type RolePermissionsReq = ValidatedAuthRequest<typeof rolePermissionsSchema>
type UpdateRolePermissionReq = ValidatedAuthRequest<typeof updateRolePermissionSchema>
type BulkUpdateReq = ValidatedAuthRequest<typeof bulkUpdateRolePermissionsSchema>

export class RolePermissionsController {
  private service = new RolePermissionsService()

  getByRoleId = async (req: Request, res: Response) => {
    try {
      const { roleId } = (req as RolePermissionsReq).validated.params
      const permissions = await this.service.getByRoleId(roleId)
      sendSuccess(res, permissions, 'Role permissions retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_role_permissions', roleId: req.params.roleId })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateRolePermissionReq).validated
      const permission = await this.service.update(params.roleId, params.moduleId, body, req.user?.id)
      sendSuccess(res, permission, 'Role permission updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_role_permission', roleId: req.params.roleId, moduleId: req.params.moduleId })
    }
  }

  bulkUpdate = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as BulkUpdateReq).validated
      const updates = body.map(item => ({
        moduleId: item.module_id,
        permissions: {
          can_view: item.can_view,
          can_insert: item.can_insert,
          can_update: item.can_update,
          can_delete: item.can_delete,
        },
      }))
      await this.service.bulkUpdate(params.roleId, updates, req.user?.id)
      sendSuccess(res, null, 'Role permissions updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_role_permissions', roleId: req.params.roleId })
    }
  }
}
