import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { productsController } from './products.controller'
import productUomsRoutes from '../product-uoms/product-uoms.routes'
import { PermissionService } from '../../services/permission.service'
import { createProductSchema, updateProductSchema, productIdSchema, bulkDeleteSchema, bulkUpdateStatusSchema, bulkRestoreSchema, checkProductNameSchema } from './products.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

PermissionService.registerModule('products', 'Product Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/export', canView('products'), (req, res) => 
  productsController.export(req as AuthenticatedRequest, res))

router.post('/import/preview', canInsert('products'), upload.single('file'), (req, res) => 
  productsController.importPreview(req as AuthenticatedRequest, res))

router.post('/import', canInsert('products'), upload.single('file'), (req, res) => 
  productsController.import(req as AuthenticatedRequest, res))

router.get('/', canView('products'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => 
  productsController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('products'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => 
  productsController.search(req as AuthenticatedQueryRequest, res))

router.get('/filter-options', canView('products'), (req, res) => 
  productsController.getFilterOptions(req as AuthenticatedRequest, res))

router.get('/minimal/active', authenticate, (req, res) => 
  productsController.minimalActive(req as AuthenticatedRequest, res))

router.get('/check/name', canView('products'), validateSchema(checkProductNameSchema), (req, res) => 
  productsController.checkProductName(req as AuthenticatedRequest, res))

router.get('/:id', canView('products'), validateSchema(productIdSchema), productsController.findById)

router.post('/', canInsert('products'), validateSchema(createProductSchema), productsController.create)

router.put('/:id', canUpdate('products'), validateSchema(updateProductSchema), productsController.update)

router.delete('/:id', canDelete('products'), validateSchema(productIdSchema), (req, res) => 
  productsController.delete(req as AuthenticatedRequest, res))

router.post('/bulk/delete', canDelete('products'), validateSchema(bulkDeleteSchema), productsController.bulkDelete)

router.post('/bulk/update-status', canUpdate('products'), validateSchema(bulkUpdateStatusSchema), productsController.bulkUpdateStatus)

router.post('/bulk/restore', canUpdate('products'), validateSchema(bulkRestoreSchema), productsController.bulkRestore)

router.post('/:id/restore', canUpdate('products'), validateSchema(productIdSchema), productsController.restore)

router.use('/:productId/uoms', productUomsRoutes)

export default router
