import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { productsController } from './products.controller'
import productUomsRoutes from '../product-uoms/product-uoms.routes'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import multer from 'multer'

const router = Router()
// amazonq-ignore-next-line
const upload = multer({ storage: multer.memoryStorage() })

PermissionService.registerModule('products', 'Product Management').catch(() => {})

router.use(authenticate)

router.get('/export', canView('products'), (req, res) => 
  productsController.export(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.post('/import/preview', canInsert('products'), upload.single('file'), (req, res) => 
  productsController.importPreview(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.post('/import', canInsert('products'), upload.single('file'), (req, res) => 
  productsController.import(req as AuthenticatedRequest, res))

router.get('/', canView('products'), paginationMiddleware, sortMiddleware, (req, res) => 
  productsController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('products'), paginationMiddleware, sortMiddleware, (req, res) => 
  productsController.search(req as AuthenticatedQueryRequest, res))

router.get('/filter-options', canView('products'), (req, res) => 
  productsController.getFilterOptions(req as AuthenticatedRequest, res))

router.get('/minimal/active', authenticate, (req, res) => 
  productsController.minimalActive(req as AuthenticatedRequest, res))

router.get('/check/name', canView('products'), (req, res) => 
  productsController.checkProductName(req as AuthenticatedRequest, res))

router.get('/:id', canView('products'), (req, res) => 
  productsController.getById(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
// amazonq-ignore-next-line
router.post('/', canInsert('products'), (req, res) => 
  productsController.create(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.put('/:id', canUpdate('products'), (req, res) => 
  productsController.update(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.delete('/:id', canDelete('products'), (req, res) => 
  productsController.delete(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.post('/bulk/delete', canDelete('products'), (req, res) => 
  productsController.bulkDelete(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.post('/bulk/update-status', canUpdate('products'), (req, res) => 
  productsController.bulkUpdateStatus(req as AuthenticatedRequest, res))

// amazonq-ignore-next-line
router.post('/:id/restore', canUpdate('products'), (req, res) => 
  productsController.restore(req as AuthenticatedRequest, res))

router.use('/:productId/uoms', productUomsRoutes)

export default router
