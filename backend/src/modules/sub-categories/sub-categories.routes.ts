import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { subCategoriesController } from './sub-categories.controller'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

PermissionService.registerModule('sub_categories', 'SubCategory Management').catch(() => {})

router.use(authenticate)

router.get('/search', canView('sub_categories'), paginationMiddleware, sortMiddleware, (req, res) => 
  subCategoriesController.search(req as AuthenticatedQueryRequest, res))

router.get('/trash', canView('sub_categories'), paginationMiddleware, sortMiddleware, (req, res) => 
  subCategoriesController.trash(req as AuthenticatedQueryRequest, res))

router.get('/category/:categoryId', canView('sub_categories'), (req, res) => 
  subCategoriesController.getByCategory(req as AuthenticatedRequest, res))

router.get('/', canView('sub_categories'), paginationMiddleware, sortMiddleware, (req, res) => 
  subCategoriesController.list(req as AuthenticatedQueryRequest, res))

router.get('/:id', canView('sub_categories'), (req, res) => 
  subCategoriesController.getById(req as AuthenticatedRequest, res))

router.post('/', canInsert('sub_categories'), (req, res) => 
  subCategoriesController.create(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('sub_categories'), (req, res) => 
  subCategoriesController.update(req as AuthenticatedRequest, res))

router.delete('/:id', canDelete('sub_categories'), (req, res) => 
  subCategoriesController.delete(req as AuthenticatedRequest, res))

router.patch('/:id/restore', canUpdate('sub_categories'), (req, res) => 
  subCategoriesController.restore(req as AuthenticatedRequest, res))

router.post('/bulk/delete', canDelete('sub_categories'), (req, res) => 
  subCategoriesController.bulkDelete(req as AuthenticatedRequest, res))

export default router
