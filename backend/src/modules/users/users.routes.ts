// =====================================================
// USERS ROUTES
// =====================================================

import { Router } from 'express'
import { UsersController } from './users.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { adminOnly } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'

// Auto-register users module
PermissionService.registerModule('users', 'User Management System')

const router = Router()
const controller = new UsersController()

// All user management routes require authentication + admin role
router.use(authenticate)
router.use(adminOnly)

router.get('/', controller.getAllUsers)
router.get('/:userId/role', controller.getUserRole)
router.put('/:userId/role', controller.assignRole)
router.delete('/:userId/role', controller.removeRole)

export default router
