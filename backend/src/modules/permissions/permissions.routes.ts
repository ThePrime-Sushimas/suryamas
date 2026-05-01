import { Router, Request, Response } from 'express'
import { ModulesController } from './modules.controller'
import { RolesController } from './roles.controller'
import { RolePermissionsController } from './role-permissions.controller'
import { SeedController } from './seed.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { handleError } from '../../utils/error-handler.util'
import {
  moduleIdSchema, createModuleSchema, updateModuleSchema,
  roleIdSchema, createRoleSchema, updateRoleSchema,
  rolePermissionsSchema, updateRolePermissionSchema, bulkUpdateRolePermissionsSchema,
} from './permissions.schema'

PermissionService.registerModule('permissions', 'Permission Management System')

const router = Router()
const modulesController = new ModulesController()
const rolesController = new RolesController()
const rolePermissionsController = new RolePermissionsController()
const seedController = new SeedController()

router.use(authenticate, resolveBranchContext)

// MODULES
router.get('/modules', canView('permissions'), (req, res) => modulesController.getAll(req, res))
router.get('/modules/:id', canView('permissions'), validateSchema(moduleIdSchema), (req, res) => modulesController.findById(req, res))
router.post('/modules', canInsert('permissions'), validateSchema(createModuleSchema), (req, res) => modulesController.create(req, res))
router.put('/modules/:id', canUpdate('permissions'), validateSchema(updateModuleSchema), (req, res) => modulesController.update(req, res))
router.delete('/modules/:id', canDelete('permissions'), validateSchema(moduleIdSchema), (req, res) => modulesController.delete(req, res))

// ROLES
router.get('/roles', canView('permissions'), (req, res) => rolesController.getAll(req, res))
router.get('/roles/:id', canView('permissions'), validateSchema(roleIdSchema), (req, res) => rolesController.findById(req, res))
router.post('/roles', canInsert('permissions'), validateSchema(createRoleSchema), (req, res) => rolesController.create(req, res))
router.put('/roles/:id', canUpdate('permissions'), validateSchema(updateRoleSchema), (req, res) => rolesController.update(req, res))
router.delete('/roles/:id', canDelete('permissions'), validateSchema(roleIdSchema), (req, res) => rolesController.delete(req, res))

// ROLE PERMISSIONS
router.get('/roles/:roleId/permissions', canView('permissions'), validateSchema(rolePermissionsSchema), (req, res) => rolePermissionsController.getByRoleId(req, res))
router.put('/roles/:roleId/permissions/:moduleId', canUpdate('permissions'), validateSchema(updateRolePermissionSchema), (req, res) => rolePermissionsController.update(req, res))
router.put('/roles/:roleId/permissions', canUpdate('permissions'), validateSchema(bulkUpdateRolePermissionsSchema), (req, res) => rolePermissionsController.bulkUpdate(req, res))

// SEED
router.post('/seed-defaults', canInsert('permissions'), (req, res) => seedController.seedDefaults(req, res))

// USER PERMISSIONS
router.get('/me/permissions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' })

    const roleId = req.query.roleId as string | undefined
    const permissions = roleId
      ? await PermissionService.getUserPermissionsByRole(roleId)
      : await PermissionService.getUserPermissions(userId)

    res.json({ success: true, data: permissions })
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_my_permissions' })
  }
})

export default router
