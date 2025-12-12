// =====================================================
// PERMISSIONS ROUTES
// =====================================================

import { Router } from 'express'
import { PermissionsController } from './permissions.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'

// Auto-register permissions module
PermissionService.registerModule('permissions', 'Permission Management System')

const router = Router()
const controller = new PermissionsController()

// All permission management routes require authentication
router.use(authenticate)

// =====================================================
// MODULES
// =====================================================
router.get('/modules', canView('permissions'), controller.getAllModules)
router.get('/modules/:id', canView('permissions'), controller.getModuleById)
router.post('/modules', canInsert('permissions'), controller.createModule)
router.put('/modules/:id', canUpdate('permissions'), controller.updateModule)
router.delete('/modules/:id', canDelete('permissions'), controller.deleteModule)

// =====================================================
// ROLES
// =====================================================
router.get('/roles', canView('permissions'), controller.getAllRoles)
router.get('/roles/:id', canView('permissions'), controller.getRoleById)
router.post('/roles', canInsert('permissions'), controller.createRole)
router.put('/roles/:id', canUpdate('permissions'), controller.updateRole)
router.delete('/roles/:id', canDelete('permissions'), controller.deleteRole)

// =====================================================
// ROLE PERMISSIONS
// =====================================================
router.get('/roles/:roleId/permissions', canView('permissions'), controller.getRolePermissions)
router.put('/roles/:roleId/permissions/:moduleId', canUpdate('permissions'), controller.updateRolePermission)
router.put('/roles/:roleId/permissions', canUpdate('permissions'), controller.bulkUpdateRolePermissions)

// =====================================================
// SEED
// =====================================================
router.post('/seed-defaults', canInsert('permissions'), controller.seedDefaults)

export default router
