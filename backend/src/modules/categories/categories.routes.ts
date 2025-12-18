import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { categoriesController } from './categories.controller'
import { PermissionService } from '../../services/permission.service'

const router = Router()

PermissionService.registerModule('categories', 'Category Management').catch(() => {})

router.use(authenticate)

router.get('/search', canView('categories'), paginationMiddleware, sortMiddleware, categoriesController.search)

router.get('/trash', canView('categories'), paginationMiddleware, sortMiddleware, categoriesController.trash)

router.get('/', canView('categories'), paginationMiddleware, sortMiddleware, categoriesController.list)

router.get('/:id', canView('categories'), categoriesController.getById)

router.post('/', canInsert('categories'), categoriesController.create)

router.put('/:id', canUpdate('categories'), categoriesController.update)

router.delete('/:id', canDelete('categories'), categoriesController.delete)

router.patch('/:id/restore', canUpdate('categories'), categoriesController.restore)

router.post('/bulk/delete', canDelete('categories'), categoriesController.bulkDelete)

export default router
