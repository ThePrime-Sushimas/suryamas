import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canUpdate } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('users', 'User Management System')

const router = Router()
const controller = new UsersController()

router.use(authenticate)

router.get('/', canView('users'), (req, res) => 
  controller.getAllUsers(req as AuthenticatedRequest, res))

router.get('/:userId', canView('users'), (req, res) => 
  controller.getUserById(req as AuthenticatedRequest, res))

router.get('/:userId/role', canView('users'), (req, res) => 
  controller.getUserRole(req as AuthenticatedRequest, res))

router.put('/:userId/role', canUpdate('users'), (req, res) => 
  controller.assignRole(req as AuthenticatedRequest, res))

router.delete('/:userId/role', canUpdate('users'), (req, res) => 
  controller.removeRole(req as AuthenticatedRequest, res))

export default router
