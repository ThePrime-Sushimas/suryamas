import { Router } from 'express'
import { PermissionsController } from './permissions.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('permissions', 'Permission Management System')

const router = Router()
const controller = new PermissionsController()

router.use(authenticate)

// MODULES
router.get('/modules', canView('permissions'), (req, res) => 
  controller.getAllModules(req as AuthenticatedRequest, res))

router.get('/modules/:id', canView('permissions'), (req, res) => 
  controller.getModuleById(req as AuthenticatedRequest, res))

router.post('/modules', canInsert('permissions'), (req, res) => 
  controller.createModule(req as AuthenticatedRequest, res))

router.put('/modules/:id', canUpdate('permissions'), (req, res) => 
  controller.updateModule(req as AuthenticatedRequest, res))

router.delete('/modules/:id', canDelete('permissions'), (req, res) => 
  controller.deleteModule(req as AuthenticatedRequest, res))

// ROLES
router.get('/roles', canView('permissions'), (req, res) => 
  controller.getAllRoles(req as AuthenticatedRequest, res))

router.get('/roles/:id', canView('permissions'), (req, res) => 
  controller.getRoleById(req as AuthenticatedRequest, res))

router.post('/roles', canInsert('permissions'), (req, res) => 
  controller.createRole(req as AuthenticatedRequest, res))

router.put('/roles/:id', canUpdate('permissions'), (req, res) => 
  controller.updateRole(req as AuthenticatedRequest, res))

router.delete('/roles/:id', canDelete('permissions'), (req, res) => 
  controller.deleteRole(req as AuthenticatedRequest, res))

// ROLE PERMISSIONS
router.get('/roles/:roleId/permissions', canView('permissions'), (req, res) => 
  controller.getRolePermissions(req as AuthenticatedRequest, res))

router.put('/roles/:roleId/permissions/:moduleId', canUpdate('permissions'), (req, res) => 
  controller.updateRolePermission(req as AuthenticatedRequest, res))

router.put('/roles/:roleId/permissions', canUpdate('permissions'), (req, res) => 
  controller.bulkUpdateRolePermissions(req as AuthenticatedRequest, res))

// SEED
router.post('/seed-defaults', canInsert('permissions'), (req, res) => 
  controller.seedDefaults(req as AuthenticatedRequest, res))

export default router
