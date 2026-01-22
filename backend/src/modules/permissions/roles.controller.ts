// =====================================================
// ROLES CONTROLLER
// Responsibility: HTTP handling for roles only
// =====================================================

import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { RolesService } from './roles.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'

import { getParamString } from '../../utils/validation.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createRoleSchema,
  updateRoleSchema,
} from './permissions.schema'

type CreateRoleReq = ValidatedAuthRequest<typeof createRoleSchema>
type UpdateRoleReq = ValidatedAuthRequest<typeof updateRoleSchema>

export class RolesController {
  private service: RolesService

  constructor() {
    this.service = new RolesService()
  }

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const roles = await this.service.getAll()
      sendSuccess(res, roles, 'Roles retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      const role = await this.service.findById(id)

      if (!role) {
        throw new Error('Role not found')
      }

      sendSuccess(res, role, 'Role retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  create = withValidated(async (req: CreateRoleReq, res: Response) => {
    try {
      const role = await this.service.create({
        name: req.validated.body.name,
        description: req.validated.body.description,
      }, req.user?.id)
      sendSuccess(res, role, 'Role created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateRoleReq, res: Response) => {
    try {
      const { id } = req.validated.params
      const role = await this.service.update(id, {
        ...(req.validated.body.name && { name: req.validated.body.name }),
        description: req.validated.body.description,
      })
      sendSuccess(res, role, 'Role updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      const success = await this.service.delete(id, req.user?.id)

      if (!success) {
        throw new Error('Failed to delete role')
      }

      sendSuccess(res, null, 'Role deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}
