import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { subCategoriesController } from './sub-categories.controller'
import { PermissionService } from '../../services/permission.service'

const router = Router()

PermissionService.registerModule('sub_categories', 'SubCategory Management').catch(() => {})

router.use(authenticate)

router.get('/search', canView('sub_categories'), paginationMiddleware, sortMiddleware, subCategoriesController.search)

router.get('/trash', canView('sub_categories'), paginationMiddleware, sortMiddleware, subCategoriesController.trash)

router.get('/category/:categoryId', canView('sub_categories'), subCategoriesController.getByCategory)

router.get('/', canView('sub_categories'), paginationMiddleware, sortMiddleware, subCategoriesController.list)

router.get('/:id', canView('sub_categories'), subCategoriesController.getById)

router.post('/', canInsert('sub_categories'), subCategoriesController.create)

router.put('/:id', canUpdate('sub_categories'), subCategoriesController.update)

router.delete('/:id', canDelete('sub_categories'), subCategoriesController.delete)

router.patch('/:id/restore', canUpdate('sub_categories'), subCategoriesController.restore)

router.post('/bulk/delete', canDelete('sub_categories'), subCategoriesController.bulkDelete)

export default router
