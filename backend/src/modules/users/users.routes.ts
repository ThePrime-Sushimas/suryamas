// =====================================================
// USERS ROUTES
// =====================================================

import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canUpdate } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'

// Auto-register users module
PermissionService.registerModule('users', 'User Management System')

const router = Router()
const controller = new UsersController()

// All user management routes require authentication
router.use(authenticate)

router.get('/', canView('users'), controller.getAllUsers)
router.get('/:userId/role', canView('users'), controller.getUserRole)
router.put('/:userId/role', canUpdate('users'), controller.assignRole)
router.delete('/:userId/role', canUpdate('users'), controller.removeRole)

export default router
