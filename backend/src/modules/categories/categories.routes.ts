import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { categoriesController } from './categories.controller'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

PermissionService.registerModule('categories', 'Category Management').catch(() => {})

router.use(authenticate)

router.get('/search', canView('categories'), paginationMiddleware, sortMiddleware, (req, res) => 
  categoriesController.search(req as AuthenticatedQueryRequest, res))

router.get('/trash', canView('categories'), paginationMiddleware, sortMiddleware, (req, res) => 
  categoriesController.trash(req as AuthenticatedQueryRequest, res))

router.get('/', canView('categories'), paginationMiddleware, sortMiddleware, (req, res) => 
  categoriesController.list(req as AuthenticatedQueryRequest, res))

router.get('/:id', canView('categories'), (req, res) => 
  categoriesController.getById(req as AuthenticatedRequest, res))

router.post('/', canInsert('categories'), (req, res) => 
  categoriesController.create(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('categories'), (req, res) => 
  categoriesController.update(req as AuthenticatedRequest, res))

router.delete('/:id', canDelete('categories'), (req, res) => 
  categoriesController.delete(req as AuthenticatedRequest, res))

router.patch('/:id/restore', canUpdate('categories'), (req, res) => 
  categoriesController.restore(req as AuthenticatedRequest, res))

router.post('/bulk/delete', canDelete('categories'), (req, res) => 
  categoriesController.bulkDelete(req as AuthenticatedRequest, res))

export default router
