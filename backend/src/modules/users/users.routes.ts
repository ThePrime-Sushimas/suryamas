import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { userIdSchema, assignRoleSchema, removeRoleSchema } from './users.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('users', 'User Management System')

const router = Router()
const controller = new UsersController()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('users'), (req, res) => 
  controller.getAllUsers(req as AuthenticatedRequest, res))

router.get('/:userId', canView('users'), validateSchema(userIdSchema), (req, res) => 
  controller.getUserById(req as AuthenticatedRequest, res))

router.get('/:userId/role', canView('users'), validateSchema(userIdSchema), (req, res) => 
  controller.getUserRole(req as AuthenticatedRequest, res))

router.put('/:userId/role', canUpdate('users'), validateSchema(assignRoleSchema), controller.assignRole)

router.delete('/:userId/role', canUpdate('users'), validateSchema(removeRoleSchema), controller.removeRole)

export default router
