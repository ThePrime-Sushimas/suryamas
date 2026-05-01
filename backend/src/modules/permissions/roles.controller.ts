import { Request, Response } from 'express'
import { RolesService } from './roles.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { PermissionErrors } from './permissions.errors'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { createRoleSchema, updateRoleSchema, roleIdSchema } from './permissions.schema'

type CreateRoleReq = ValidatedAuthRequest<typeof createRoleSchema>
type UpdateRoleReq = ValidatedAuthRequest<typeof updateRoleSchema>
type RoleIdReq = ValidatedAuthRequest<typeof roleIdSchema>

export class RolesController {
  private service = new RolesService()

  getAll = async (req: Request, res: Response) => {
    try {
      const roles = await this.service.getAll()
      sendSuccess(res, roles, 'Roles retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_all_roles' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as RoleIdReq).validated.params
      const role = await this.service.findById(id)
      if (!role) throw PermissionErrors.NOT_FOUND(id)
      sendSuccess(res, role, 'Role retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_role', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateRoleReq).validated
      const role = await this.service.create(body, req.user?.id)
      sendSuccess(res, role, 'Role created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_role' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateRoleReq).validated
      const role = await this.service.update(params.id, {
        ...(body.name && { name: body.name }),
        description: body.description,
      })
      sendSuccess(res, role, 'Role updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_role', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as RoleIdReq).validated.params
      const success = await this.service.delete(id, req.user?.id)
      if (!success) throw PermissionErrors.DELETE_FAILED('role')
      sendSuccess(res, null, 'Role deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_role', id: req.params.id })
    }
  }
}
