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
import multer from 'multer'
import rateLimit from 'express-rate-limit'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

const exportImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many export/import requests, please try again later'
})

PermissionService.registerModule('products', 'Product Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

// JOB-BASED EXPORT/IMPORT
router.post('/export/job', canView('products'), exportImportLimiter, (req, res) => productsController.createExportJob(req, res))
router.post('/import/job', canInsert('products'), upload.single('file'), exportImportLimiter, (req, res) => productsController.createImportJob(req, res))

// LEGACY EXPORT/IMPORT
router.get('/export', canView('products'), exportImportLimiter, (req, res) => productsController.export(req, res))
router.post('/import/preview', canInsert('products'), upload.single('file'), (req, res) => productsController.importPreview(req, res))
router.post('/import', canInsert('products'), upload.single('file'), exportImportLimiter, (req, res) => productsController.import(req, res))

// LIST & SEARCH
router.get('/', canView('products'), queryMiddleware({
  allowedSortFields: ['product_name', 'product_code', 'category_id', 'sub_category_id', 'created_at', 'updated_at', 'sort_order', 'id']
}), (req, res) => productsController.list(req, res))

router.get('/search', canView('products'), queryMiddleware({
  allowedSortFields: ['product_name', 'product_code', 'category_id', 'sub_category_id', 'created_at', 'updated_at', 'sort_order', 'id']
}), (req, res) => productsController.search(req, res))

router.get('/filter-options', canView('products'), (req, res) => productsController.getFilterOptions(req, res))
router.get('/minimal/active', authenticate, canView('products'), (req, res) => productsController.minimalActive(req, res))
router.get('/check/name', canView('products'), validateSchema(checkProductNameSchema), (req, res) =>
  productsController.checkProductName(req, res))

// CRUD
router.get('/:id', canView('products'), validateSchema(productIdSchema), (req, res) =>
  productsController.findById(req, res))

router.post('/', canInsert('products'), validateSchema(createProductSchema), (req, res) =>
  productsController.create(req, res))

router.put('/:id', canUpdate('products'), validateSchema(updateProductSchema), (req, res) =>
  productsController.update(req, res))

router.delete('/:id', canDelete('products'), validateSchema(productIdSchema), (req, res) => productsController.delete(req, res))

// BULK
router.post('/bulk/delete', canDelete('products'), validateSchema(bulkDeleteSchema), (req, res) =>
  productsController.bulkDelete(req, res))

router.post('/bulk/update-status', canUpdate('products'), validateSchema(bulkUpdateStatusSchema), (req, res) =>
  productsController.bulkUpdateStatus(req, res))

router.post('/bulk/restore', canUpdate('products'), validateSchema(bulkRestoreSchema), (req, res) =>
  productsController.bulkRestore(req, res))

router.post('/:id/restore', canUpdate('products'), validateSchema(productIdSchema), (req, res) =>
  productsController.restore(req, res))

// NESTED UOM ROUTES
router.use('/:productId/uoms', productUomsRoutes)

export default router
