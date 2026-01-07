import { Router } from 'express'
import { ModulesController } from './modules.controller'
import { RolesController } from './roles.controller'
import { RolePermissionsController } from './role-permissions.controller'
import { SeedController } from './seed.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { 
  moduleIdSchema, createModuleSchema, updateModuleSchema,
  roleIdSchema, createRoleSchema, updateRoleSchema,
  rolePermissionsSchema, updateRolePermissionSchema, bulkUpdateRolePermissionsSchema
} from './permissions.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('permissions', 'Permission Management System')

const router = Router()
const modulesController = new ModulesController()
const rolesController = new RolesController()
const rolePermissionsController = new RolePermissionsController()
const seedController = new SeedController()

router.use(authenticate, resolveBranchContext)

// MODULES
router.get('/modules', canView('permissions'), (req, res) => 
  modulesController.getAll(req as AuthenticatedRequest, res))

router.get('/modules/:id', canView('permissions'), validateSchema(moduleIdSchema), (req, res) => 
  modulesController.findById(req as AuthenticatedRequest, res))

router.post('/modules', canInsert('permissions'), validateSchema(createModuleSchema), modulesController.create)

router.put('/modules/:id', canUpdate('permissions'), validateSchema(updateModuleSchema), modulesController.update)

router.delete('/modules/:id', canDelete('permissions'), validateSchema(moduleIdSchema), (req, res) => 
  modulesController.delete(req as AuthenticatedRequest, res))

// ROLES
router.get('/roles', canView('permissions'), (req, res) => 
  rolesController.getAll(req as AuthenticatedRequest, res))

router.get('/roles/:id', canView('permissions'), validateSchema(roleIdSchema), (req, res) => 
  rolesController.findById(req as AuthenticatedRequest, res))

router.post('/roles', canInsert('permissions'), validateSchema(createRoleSchema), rolesController.create)

router.put('/roles/:id', canUpdate('permissions'), validateSchema(updateRoleSchema), rolesController.update)

router.delete('/roles/:id', canDelete('permissions'), validateSchema(roleIdSchema), (req, res) => 
  rolesController.delete(req as AuthenticatedRequest, res))

// ROLE PERMISSIONS
router.get('/roles/:roleId/permissions', canView('permissions'), validateSchema(rolePermissionsSchema), (req, res) => 
  rolePermissionsController.getByRoleId(req as AuthenticatedRequest, res))

router.put('/roles/:roleId/permissions/:moduleId', canUpdate('permissions'), validateSchema(updateRolePermissionSchema), rolePermissionsController.update)

router.put('/roles/:roleId/permissions', canUpdate('permissions'), validateSchema(bulkUpdateRolePermissionsSchema), rolePermissionsController.bulkUpdate)

// SEED
router.post('/seed-defaults', canInsert('permissions'), (req, res) => 
  seedController.seedDefaults(req as AuthenticatedRequest, res))

// USER PERMISSIONS
router.get('/me/permissions', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id
    const roleId = req.query.roleId as string
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }
    
    const permissions = roleId 
      ? await PermissionService.getUserPermissionsByRole(roleId)
      : await PermissionService.getUserPermissions(userId)
    
    res.json({ success: true, data: permissions })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
