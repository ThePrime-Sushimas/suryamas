import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { productsController } from './products.controller'
import productUomsRoutes from '../product-uoms/product-uoms.routes'
import { PermissionService } from '../../services/permission.service'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Register module
PermissionService.registerModule('products', 'Product Management').catch(() => {})

// All routes require authentication
router.use(authenticate)

// Export
router.get(
  '/export',
  canView('products'),
  productsController.export
)

// Import preview
router.post(
  '/import/preview',
  canInsert('products'),
  upload.single('file'),
  productsController.importPreview
)

// Import
router.post(
  '/import',
  canInsert('products'),
  upload.single('file'),
  productsController.import
)

// Products routes
router.get(
  '/',
  canView('products'),
  paginationMiddleware,
  sortMiddleware,
  filterMiddleware,
  productsController.list
)

router.get(
  '/search',
  canView('products'),
  paginationMiddleware,
  sortMiddleware,
  filterMiddleware,
  productsController.search
)

router.get(
  '/filter-options',
  canView('products'),
  productsController.getFilterOptions
)

router.get(
  '/minimal/active',
  authenticate,
  productsController.minimalActive
)

router.get(
  '/:id',
  canView('products'),
  productsController.getById
)

router.post(
  '/',
  canInsert('products'),
  productsController.create
)

router.put(
  '/:id',
  canUpdate('products'),
  productsController.update
)

router.delete(
  '/:id',
  canDelete('products'),
  productsController.delete
)

router.post(
  '/bulk/update-status',
  canUpdate('products'),
  productsController.bulkUpdateStatus
)

router.post(
  '/:id/restore',
  canUpdate('products'),
  productsController.restore
)

// Product UOMs routes
router.use('/:productId/uoms', productUomsRoutes)

export default router
