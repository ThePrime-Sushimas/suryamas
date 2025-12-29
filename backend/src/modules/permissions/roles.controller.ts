// =====================================================
// ROLES CONTROLLER
// Responsibility: HTTP handling for roles only
// =====================================================

import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { RolesService } from './roles.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

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

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const role = await this.service.getById(id)

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

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const role = await this.service.create(req.body, req.user?.id)
      sendSuccess(res, role, 'Role created successfully', 201)
    } catch (error: any) {
      logError('Create role failed', { error: error.message })
      const statusCode = error.statusCode || 500
      const message = error.isOperational ? error.message : 'Failed to create role'
      sendError(res, message, statusCode)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const role = await this.service.update(id, req.body)
      sendSuccess(res, role, 'Role updated successfully')
    } catch (error: any) {
      logError('Update role failed', { error: error.message })
      sendError(res, 'Failed to update role', 500)
    }
  }

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
