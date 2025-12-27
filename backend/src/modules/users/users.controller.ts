// =====================================================
// USERS CONTROLLER
// =====================================================

import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { UsersService } from './users.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class UsersController {
  private service: UsersService

  constructor() {
    this.service = new UsersService()
  }

  getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const users = await this.service.getAllUsers()
      sendSuccess(res, users, 'Users retrieved successfully')
    } catch (error: any) {
      logError('Get users failed', { error: error.message })
      sendError(res, 'Failed to retrieve users', 500)
    }
  }

  getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params
      const user = await this.service.getUserById(userId)

      if (!user) {
        sendError(res, 'User not found', 404)
        return
      }

      sendSuccess(res, user, 'User retrieved successfully')
    } catch (error: any) {
      logError('Get user failed', { error: error.message })
      sendError(res, 'Failed to retrieve user', 500)
    }
  }

  getUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params
      const userRole = await this.service.getUserRole(userId)

      if (!userRole) {
        sendError(res, 'User not found', 404)
        return
      }

      sendSuccess(res, userRole, 'User role retrieved successfully')
    } catch (error: any) {
      logError('Get user role failed', { error: error.message })
      sendError(res, 'Failed to retrieve user role', 500)
    }
  }

  assignRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params
      const { role_id } = req.body

      if (!role_id) {
        sendError(res, 'role_id is required', 400)
        return
      }

      const result = await this.service.assignRoleByEmployeeId(userId, role_id, req.user?.id)
      sendSuccess(res, result, 'Role assigned successfully')
    } catch (error: any) {
      logError('Assign role failed', { error: error.message })
      sendError(res, 'Failed to assign role', 500)
    }
  }

  removeRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params
      await this.service.removeRoleByEmployeeId(userId, req.user?.id)
      sendSuccess(res, null, 'Role removed successfully')
    } catch (error: any) {
      logError('Remove role failed', { error: error.message })
      sendError(res, 'Failed to remove role', 500)
    }
  }
}
