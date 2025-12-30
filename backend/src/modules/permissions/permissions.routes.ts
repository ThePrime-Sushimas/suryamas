import { Router } from 'express'
import { ModulesController } from './modules.controller'
import { RolesController } from './roles.controller'
import { RolePermissionsController } from './role-permissions.controller'
import { SeedController } from './seed.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('permissions', 'Permission Management System')

const router = Router()
const modulesController = new ModulesController()
const rolesController = new RolesController()
const rolePermissionsController = new RolePermissionsController()
const seedController = new SeedController()

router.use(authenticate)

// MODULES
router.get('/modules', canView('permissions'), (req, res) => 
  modulesController.getAll(req as AuthenticatedRequest, res))

router.get('/modules/:id', canView('permissions'), (req, res) => 
  modulesController.findById(req as AuthenticatedRequest, res))

router.post('/modules', canInsert('permissions'), (req, res) => 
  modulesController.create(req as AuthenticatedRequest, res))

router.put('/modules/:id', canUpdate('permissions'), (req, res) => 
  modulesController.update(req as AuthenticatedRequest, res))

router.delete('/modules/:id', canDelete('permissions'), (req, res) => 
  modulesController.delete(req as AuthenticatedRequest, res))

// ROLES
router.get('/roles', canView('permissions'), (req, res) => 
  rolesController.getAll(req as AuthenticatedRequest, res))

router.get('/roles/:id', canView('permissions'), (req, res) => 
  rolesController.findById(req as AuthenticatedRequest, res))

router.post('/roles', canInsert('permissions'), (req, res) => 
  rolesController.create(req as AuthenticatedRequest, res))

router.put('/roles/:id', canUpdate('permissions'), (req, res) => 
  rolesController.update(req as AuthenticatedRequest, res))

router.delete('/roles/:id', canDelete('permissions'), (req, res) => 
  rolesController.delete(req as AuthenticatedRequest, res))

// ROLE PERMISSIONS
router.get('/roles/:roleId/permissions', canView('permissions'), (req, res) => 
  rolePermissionsController.getByRoleId(req as AuthenticatedRequest, res))

router.put('/roles/:roleId/permissions/:moduleId', canUpdate('permissions'), (req, res) => 
  rolePermissionsController.update(req as AuthenticatedRequest, res))

router.put('/roles/:roleId/permissions', canUpdate('permissions'), (req, res) => 
  rolePermissionsController.bulkUpdate(req as AuthenticatedRequest, res))

// SEED
router.post('/seed-defaults', canInsert('permissions'), (req, res) => 
  seedController.seedDefaults(req as AuthenticatedRequest, res))

export default router
