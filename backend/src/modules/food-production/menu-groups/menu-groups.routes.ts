import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { menuGroupsController } from './menu-groups.controller'
import { createMenuGroupSchema, updateMenuGroupSchema, menuGroupIdSchema, bulkDeleteMenuGroupSchema } from './menu-groups.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('menu_groups', 'Menu Group Management').catch((err) => {
  console.error('Failed to register menu_groups module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('menu_groups'), (req, res) => menuGroupsController.list(req, res))
router.get('/search', canView('menu_groups'), (req, res) => menuGroupsController.search(req, res))
router.post('/bulk/delete', canDelete('menu_groups'), validateSchema(bulkDeleteMenuGroupSchema), (req, res) => menuGroupsController.bulkDelete(req, res))
router.post('/', canInsert('menu_groups'), validateSchema(createMenuGroupSchema), (req, res) => menuGroupsController.create(req, res))
router.get('/:id', canView('menu_groups'), validateSchema(menuGroupIdSchema), (req, res) => menuGroupsController.getById(req, res))
router.put('/:id', canUpdate('menu_groups'), validateSchema(updateMenuGroupSchema), (req, res) => menuGroupsController.update(req, res))
router.delete('/:id', canDelete('menu_groups'), validateSchema(menuGroupIdSchema), (req, res) => menuGroupsController.delete(req, res))
router.patch('/:id/restore', canUpdate('menu_groups'), validateSchema(menuGroupIdSchema), (req, res) => menuGroupsController.restore(req, res))

export default router
