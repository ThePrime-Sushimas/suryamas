import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { productsController } from './products.controller'
import productUomsRoutes from '../product-uoms/product-uoms.routes'
import { PermissionService } from '../../services/permission.service'
import { createProductSchema, updateProductSchema, productIdSchema, bulkDeleteSchema, bulkUpdateStatusSchema, bulkRestoreSchema, checkProductNameSchema } from './products.schema'
import type { AuthenticatedQueryRequest } from '../../types/request.types'
import multer from 'multer'
import rateLimit from 'express-rate-limit'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Rate limiter for export/import operations
const exportImportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many export/import requests, please try again later'
})

PermissionService.registerModule('products', 'Product Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

// ============================================
// JOB-BASED EXPORT/IMPORT ENDPOINTS
// ============================================

// Create export job - returns job ID immediately
router.post('/export/job', 
  canView('products'),
  exportImportLimiter,
  (req, res) => productsController.createExportJob(req as AuthenticatedQueryRequest, res)
)

// Create import job - returns job ID immediately
router.post('/import/job', 
  canInsert('products'),
  upload.single('file'),
  exportImportLimiter,
  (req, res) => productsController.createImportJob(req as AuthenticatedQueryRequest, res)
)

// ============================================
// LEGACY ENDPOINTS (for backward compatibility - now uses jobs)
// ============================================

router.get('/export', canView('products'), exportImportLimiter, (req, res) => 
  productsController.export(req as AuthenticatedQueryRequest, res))

router.post('/import/preview', canInsert('products'), upload.single('file'), (req, res) => 
  productsController.importPreview(req as AuthenticatedQueryRequest, res))

router.post('/import', canInsert('products'), upload.single('file'), exportImportLimiter, (req, res) => 
  productsController.import(req as AuthenticatedQueryRequest, res))

// ============================================
// CRUD ENDPOINTS
// ============================================

router.get('/', canView('products'), queryMiddleware({
  allowedSortFields: ['product_name', 'product_code', 'category_id', 'sub_category_id', 'created_at', 'updated_at', 'sort_order', 'id']
}), (req, res) => 
  productsController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('products'), queryMiddleware({
  allowedSortFields: ['product_name', 'product_code', 'category_id', 'sub_category_id', 'created_at', 'updated_at', 'sort_order', 'id']
}), (req, res) => 
  productsController.search(req as AuthenticatedQueryRequest, res))

router.get('/filter-options', canView('products'), (req, res) => 
  productsController.getFilterOptions(req as AuthenticatedQueryRequest, res))

router.get('/minimal/active', authenticate, (req, res) => 
  productsController.minimalActive(req as AuthenticatedQueryRequest, res))

router.get('/check/name', canView('products'), validateSchema(checkProductNameSchema), (req, res) => 
  productsController.checkProductName(req as AuthenticatedQueryRequest, res))

router.get('/:id', canView('products'), validateSchema(productIdSchema), productsController.findById)

router.post('/', canInsert('products'), validateSchema(createProductSchema), productsController.create)

router.put('/:id', canUpdate('products'), validateSchema(updateProductSchema), productsController.update)

router.delete('/:id', canDelete('products'), validateSchema(productIdSchema), (req, res) => 
  productsController.delete(req as AuthenticatedQueryRequest, res))

router.post('/bulk/delete', canDelete('products'), validateSchema(bulkDeleteSchema), productsController.bulkDelete)

router.post('/bulk/update-status', canUpdate('products'), validateSchema(bulkUpdateStatusSchema), productsController.bulkUpdateStatus)

router.post('/bulk/restore', canUpdate('products'), validateSchema(bulkRestoreSchema), productsController.bulkRestore)

router.post('/:id/restore', canUpdate('products'), validateSchema(productIdSchema), productsController.restore)

router.use('/:productId/uoms', productUomsRoutes)

export default router

