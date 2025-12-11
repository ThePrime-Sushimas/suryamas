// =====================================================
// PERMISSIONS ROUTES
// =====================================================

import { Router } from 'express'
import { PermissionsController } from './permissions.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { adminOnly } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'

// Auto-register permissions module
PermissionService.registerModule('permissions', 'Permission Management System')

const router = Router()
const controller = new PermissionsController()

// All permission management routes require authentication + admin role
router.use(authenticate)
router.use(adminOnly)

// =====================================================
// MODULES
// =====================================================
router.get('/modules', controller.getAllModules)
router.get('/modules/:id', controller.getModuleById)
router.post('/modules', controller.createModule)
router.put('/modules/:id', controller.updateModule)
router.delete('/modules/:id', controller.deleteModule)

// =====================================================
// ROLES
// =====================================================
router.get('/roles', controller.getAllRoles)
router.get('/roles/:id', controller.getRoleById)
router.post('/roles', controller.createRole)
router.put('/roles/:id', controller.updateRole)
router.delete('/roles/:id', controller.deleteRole)

// =====================================================
// ROLE PERMISSIONS
// =====================================================
router.get('/roles/:roleId/permissions', controller.getRolePermissions)
router.put('/roles/:roleId/permissions/:moduleId', controller.updateRolePermission)
router.put('/roles/:roleId/permissions', controller.bulkUpdateRolePermissions)

// =====================================================
// SEED
// =====================================================
router.post('/seed-defaults', controller.seedDefaults)

export default router
