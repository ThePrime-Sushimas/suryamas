import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { UsersService } from './users.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  userIdSchema,
  assignRoleSchema,
  removeRoleSchema,
} from './users.schema'

type UserIdReq = ValidatedAuthRequest<typeof userIdSchema>
type AssignRoleReq = ValidatedAuthRequest<typeof assignRoleSchema>
type RemoveRoleReq = ValidatedAuthRequest<typeof removeRoleSchema>


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
      const user = await this.service.getUserByEmployeeId(userId)

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
      const userRole = await this.service.getUserRoleByEmployeeId(userId)

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

  assignRole = withValidated(async (req: AssignRoleReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const result = await this.service.assignRoleByEmployeeId(params.userId, body.role_id, req.user?.id)
      sendSuccess(res, result, 'Role assigned successfully')
    } catch (error: any) {
      logError('Assign role failed', { error: error.message })
      sendError(res, 'Failed to assign role', 500)
    }
  })

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
