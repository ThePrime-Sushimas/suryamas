import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { subCategoriesController } from './sub-categories.controller'
import { PermissionService } from '../../services/permission.service'
import { CreateSubCategorySchema, UpdateSubCategorySchema, subCategoryIdSchema, BulkDeleteSchema, categoryIdSchema } from './sub-categories.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

PermissionService.registerModule('sub_categories', 'SubCategory Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/search', canView('sub_categories'), queryMiddleware({
  allowedSortFields: ['sub_category_code', 'sub_category_name', 'category_id', 'sort_order', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  subCategoriesController.search(req as AuthenticatedQueryRequest, res))

router.get('/trash', canView('sub_categories'), queryMiddleware({
  allowedSortFields: ['sub_category_code', 'sub_category_name', 'category_id', 'sort_order', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  subCategoriesController.trash(req as AuthenticatedQueryRequest, res))

router.get('/category/:categoryId', canView('sub_categories'), validateSchema(categoryIdSchema), (req, res) => 
  subCategoriesController.getByCategory(req as AuthenticatedRequest, res))

router.get('/', canView('sub_categories'), queryMiddleware({
  allowedSortFields: ['sub_category_code', 'sub_category_name', 'category_id', 'sort_order', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  subCategoriesController.list(req as AuthenticatedQueryRequest, res))

router.get('/:id', canView('sub_categories'), validateSchema(subCategoryIdSchema), (req, res) => 
  subCategoriesController.getById(req as AuthenticatedRequest, res))

router.post('/', canInsert('sub_categories'), validateSchema(CreateSubCategorySchema), subCategoriesController.create)

router.put('/:id', canUpdate('sub_categories'), validateSchema(UpdateSubCategorySchema), subCategoriesController.update)

router.delete('/:id', canDelete('sub_categories'), validateSchema(subCategoryIdSchema), (req, res) => 
  subCategoriesController.delete(req as AuthenticatedRequest, res))

router.patch('/:id/restore', canUpdate('sub_categories'), validateSchema(subCategoryIdSchema), (req, res) => 
  subCategoriesController.restore(req as AuthenticatedRequest, res))

router.post('/bulk/delete', canDelete('sub_categories'), validateSchema(BulkDeleteSchema), subCategoriesController.bulkDelete)

export default router
