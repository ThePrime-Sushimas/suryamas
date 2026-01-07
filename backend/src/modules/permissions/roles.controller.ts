// =====================================================
// ROLES CONTROLLER
// Responsibility: HTTP handling for roles only
// =====================================================

import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { RolesService } from './roles.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'
import { withValidated } from '../../utils/handler'
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
      logError('Get roles failed', { error: error.message })
      sendError(res, 'Failed to retrieve roles', 500)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const role = await this.service.findById(id)

      if (!role) {
        sendError(res, 'Role not found', 404)
        return
      }

      sendSuccess(res, role, 'Role retrieved successfully')
    } catch (error: any) {
      logError('Get role failed', { error: error.message })
      sendError(res, 'Failed to retrieve role', 500)
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
      logError('Create role failed', { error: error.message })
      const statusCode = error.statusCode || 500
      const message = error.isOperational ? error.message : 'Failed to create role'
      sendError(res, message, statusCode)
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
      logError('Update role failed', { error: error.message })
      sendError(res, 'Failed to update role', 500)
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const success = await this.service.delete(id, req.user?.id)

      if (!success) {
        sendError(res, 'Failed to delete role', 400)
        return
      }

      sendSuccess(res, null, 'Role deleted successfully')
    } catch (error: any) {
      logError('Delete role failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete role', 500)
    }
  }
}
