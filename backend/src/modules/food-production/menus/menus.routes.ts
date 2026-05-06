import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { menusController } from './menus.controller'
import { createMenuSchema, updateMenuSchema, menuIdSchema, bulkDeleteMenuSchema, syncMenusSchema } from './menus.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('menus', 'Menu Management').catch((err) => {
  console.error('Failed to register menus module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('menus'), (req, res) => menusController.list(req, res))
router.get('/search', canView('menus'), (req, res) => menusController.search(req, res))
router.post('/sync', canUpdate('menus'), validateSchema(syncMenusSchema), (req, res) => menusController.syncFromPos(req, res))
router.post('/bulk/delete', canDelete('menus'), validateSchema(bulkDeleteMenuSchema), (req, res) => menusController.bulkDelete(req, res))
router.post('/', canInsert('menus'), validateSchema(createMenuSchema), (req, res) => menusController.create(req, res))
router.get('/:id', canView('menus'), validateSchema(menuIdSchema), (req, res) => menusController.getById(req, res))
router.put('/:id', canUpdate('menus'), validateSchema(updateMenuSchema), (req, res) => menusController.update(req, res))
router.delete('/:id', canDelete('menus'), validateSchema(menuIdSchema), (req, res) => menusController.delete(req, res))
router.patch('/:id/restore', canUpdate('menus'), validateSchema(menuIdSchema), (req, res) => menusController.restore(req, res))

export default router
