import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { categoriesController } from './categories.controller'
import { PermissionService } from '../../services/permission.service'
import { CreateCategorySchema, UpdateCategorySchema, categoryIdSchema, BulkDeleteSchema, UpdateStatusSchema } from './categories.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

PermissionService.registerModule('categories', 'Category Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/', canView('categories'), queryMiddleware({
  allowedSortFields: ['category_code', 'category_name', 'sort_order', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  categoriesController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('categories'), queryMiddleware({
  allowedSortFields: ['category_code', 'category_name', 'sort_order', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  categoriesController.search(req as AuthenticatedQueryRequest, res))

router.get('/trash', canView('categories'), queryMiddleware({
  allowedSortFields: ['category_code', 'category_name', 'sort_order', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  categoriesController.trash(req as AuthenticatedQueryRequest, res))

router.get('/:id', canView('categories'), validateSchema(categoryIdSchema), (req, res) => 
  categoriesController.getById(req as AuthenticatedRequest, res))

router.post('/', canInsert('categories'), validateSchema(CreateCategorySchema), categoriesController.create)

router.put('/:id', canUpdate('categories'), validateSchema(UpdateCategorySchema), categoriesController.update)

router.delete('/:id', canDelete('categories'), validateSchema(categoryIdSchema), (req, res) => 
  categoriesController.delete(req as AuthenticatedRequest, res))

router.patch('/:id/restore', canUpdate('categories'), validateSchema(categoryIdSchema), (req, res) => 
  categoriesController.restore(req as AuthenticatedRequest, res))

router.patch('/:id/status', canUpdate('categories'), validateSchema(UpdateStatusSchema), categoriesController.updateStatus)

router.post('/bulk/delete', canDelete('categories'), validateSchema(BulkDeleteSchema), categoriesController.bulkDelete)

export default router
