import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { menuCategoriesController } from './menu-categories.controller'
import { createMenuCategorySchema, updateMenuCategorySchema, menuCategoryIdSchema, bulkDeleteMenuCategorySchema } from './menu-categories.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('menu_categories', 'Menu Category Management').catch((err) => {
  console.error('Failed to register menu_categories module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('menu_categories'), (req, res) => menuCategoriesController.list(req, res))
router.get('/search', canView('menu_categories'), (req, res) => menuCategoriesController.search(req, res))
router.post('/bulk/delete', canDelete('menu_categories'), validateSchema(bulkDeleteMenuCategorySchema), (req, res) => menuCategoriesController.bulkDelete(req, res))
router.post('/', canInsert('menu_categories'), validateSchema(createMenuCategorySchema), (req, res) => menuCategoriesController.create(req, res))
router.get('/:id', canView('menu_categories'), validateSchema(menuCategoryIdSchema), (req, res) => menuCategoriesController.getById(req, res))
router.put('/:id', canUpdate('menu_categories'), validateSchema(updateMenuCategorySchema), (req, res) => menuCategoriesController.update(req, res))
router.delete('/:id', canDelete('menu_categories'), validateSchema(menuCategoryIdSchema), (req, res) => menuCategoriesController.delete(req, res))
router.patch('/:id/restore', canUpdate('menu_categories'), validateSchema(menuCategoryIdSchema), (req, res) => menuCategoriesController.restore(req, res))

export default router
