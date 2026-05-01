import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { categoriesController } from './categories.controller'
import { PermissionService } from '../../services/permission.service'
import { CreateCategorySchema, UpdateCategorySchema, categoryIdSchema, BulkDeleteSchema, UpdateStatusSchema } from './categories.schema'

const router = Router()

PermissionService.registerModule('categories', 'Category Management').catch((err) => {
  console.error('Failed to register categories module:', err instanceof Error ? err.message : err)
})

const sortFields = ['category_code', 'category_name', 'sort_order', 'created_at', 'updated_at', 'id']

router.use(authenticate, resolveBranchContext)

router.get('/', canView('categories'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => categoriesController.list(req, res))
router.get('/search', canView('categories'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => categoriesController.search(req, res))
router.get('/trash', canView('categories'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => categoriesController.trash(req, res))
router.get('/:id', canView('categories'), validateSchema(categoryIdSchema), (req, res) => categoriesController.getById(req, res))
router.post('/', canInsert('categories'), validateSchema(CreateCategorySchema), (req, res) => categoriesController.create(req, res))
router.put('/:id', canUpdate('categories'), validateSchema(UpdateCategorySchema), (req, res) => categoriesController.update(req, res))
router.delete('/:id', canDelete('categories'), validateSchema(categoryIdSchema), (req, res) => categoriesController.delete(req, res))
router.patch('/:id/restore', canUpdate('categories'), validateSchema(categoryIdSchema), (req, res) => categoriesController.restore(req, res))
router.patch('/:id/status', canUpdate('categories'), validateSchema(UpdateStatusSchema), (req, res) => categoriesController.updateStatus(req, res))
router.post('/bulk/delete', canDelete('categories'), validateSchema(BulkDeleteSchema), (req, res) => categoriesController.bulkDelete(req, res))

export default router
