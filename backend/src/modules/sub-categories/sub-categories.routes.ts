import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema, type ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { subCategoriesController } from './sub-categories.controller'
import { PermissionService } from '../../services/permission.service'
import { CreateSubCategorySchema, UpdateSubCategorySchema, subCategoryIdSchema, BulkDeleteSchema, categoryIdSchema } from './sub-categories.schema'

const router = Router()

PermissionService.registerModule('sub_categories', 'SubCategory Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

const sortFields = ['sub_category_code', 'sub_category_name', 'category_id', 'sort_order', 'created_at', 'updated_at', 'id']

router.get('/search', canView('sub_categories'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) =>
  subCategoriesController.search(req, res))

router.get('/trash', canView('sub_categories'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) =>
  subCategoriesController.trash(req, res))

router.get('/category/:categoryId', canView('sub_categories'), validateSchema(categoryIdSchema), (req, res) =>
  subCategoriesController.getByCategory(req as ValidatedAuthRequest<typeof categoryIdSchema>, res))

router.get('/', canView('sub_categories'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) =>
  subCategoriesController.list(req, res))

router.get('/:id', canView('sub_categories'), validateSchema(subCategoryIdSchema), (req, res) =>
  subCategoriesController.getById(req as ValidatedAuthRequest<typeof subCategoryIdSchema>, res))

router.post('/', canInsert('sub_categories'), validateSchema(CreateSubCategorySchema), (req, res) =>
  subCategoriesController.create(req as ValidatedAuthRequest<typeof CreateSubCategorySchema>, res))

router.put('/:id', canUpdate('sub_categories'), validateSchema(UpdateSubCategorySchema), (req, res) =>
  subCategoriesController.update(req as ValidatedAuthRequest<typeof UpdateSubCategorySchema>, res))

router.delete('/:id', canDelete('sub_categories'), validateSchema(subCategoryIdSchema), (req, res) =>
  subCategoriesController.delete(req as ValidatedAuthRequest<typeof subCategoryIdSchema>, res))

router.patch('/:id/restore', canUpdate('sub_categories'), validateSchema(subCategoryIdSchema), (req, res) =>
  subCategoriesController.restore(req as ValidatedAuthRequest<typeof subCategoryIdSchema>, res))

router.post('/bulk/delete', canDelete('sub_categories'), validateSchema(BulkDeleteSchema), (req, res) =>
  subCategoriesController.bulkDelete(req as ValidatedAuthRequest<typeof BulkDeleteSchema>, res))

export default router
