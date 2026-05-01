import { Request, Response } from 'express'
import { UsersService } from './users.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { UserErrors } from './users.errors'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { userIdSchema, assignRoleSchema, removeRoleSchema } from './users.schema'

type UserIdReq = ValidatedAuthRequest<typeof userIdSchema>
type AssignRoleReq = ValidatedAuthRequest<typeof assignRoleSchema>
type RemoveRoleReq = ValidatedAuthRequest<typeof removeRoleSchema>

export class UsersController {
  private service = new UsersService()

  getAllUsers = async (req: Request, res: Response) => {
    try {
      const users = await this.service.getAllUsers()
      sendSuccess(res, users, 'Users retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_all_users' })
    }
  }

  getUserById = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as UserIdReq).validated.params
      const user = await this.service.getUserByEmployeeId(userId)
      if (!user) throw UserErrors.NOT_FOUND(userId)
      sendSuccess(res, user, 'User retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_user', userId: req.params.userId })
    }
  }

  getUserRole = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as UserIdReq).validated.params
      const userRole = await this.service.getUserRoleByEmployeeId(userId)
      sendSuccess(res, userRole, userRole ? 'User role retrieved successfully' : 'User has no role assigned')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_user_role', userId: req.params.userId })
    }
  }

  assignRole = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as AssignRoleReq).validated
      const result = await this.service.assignRoleByEmployeeId(params.userId, body.role_id, req.user?.id)
      sendSuccess(res, result, 'Role assigned successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'assign_role', userId: req.params.userId })
    }
  }

  removeRole = async (req: Request, res: Response) => {
    try {
      const { userId } = (req as RemoveRoleReq).validated.params
      await this.service.removeRoleByEmployeeId(userId, req.user?.id)
      sendSuccess(res, null, 'Role removed successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'remove_role', userId: req.params.userId })
    }
  }
}
