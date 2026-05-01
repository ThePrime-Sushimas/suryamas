import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema, type ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { supplierProductsRateLimit } from '../../middleware/rateLimiter.middleware'
import { supplierProductsController } from './supplier-products.controller'
import {
  createSupplierProductSchema,
  updateSupplierProductSchema,
  supplierProductIdSchema,
  bulkDeleteSchema,
  supplierProductListSchema,
  getBySupplierSchema,
  getByProductSchema,
} from './supplier-products.schema'
import { PermissionService } from '../../services/permission.service'

const router = Router()

PermissionService.registerModule('supplier_products', 'Supplier Product Management').catch(() => {})

router.use(authenticate, resolveBranchContext)
router.use(supplierProductsRateLimit)

const sortFields = ['supplier_id', 'product_id', 'price', 'created_at', 'updated_at', 'id']

// Options & Export (before /:id)
router.get('/options/active', canView('supplier_products'), (req, res) =>
  supplierProductsController.getActiveOptions(req, res))

router.get('/export', canView('supplier_products'), (req, res) =>
  supplierProductsController.exportCSV(req, res))

// By supplier/product
router.get('/supplier/:supplier_id', canView('supplier_products'), validateSchema(getBySupplierSchema), (req, res) =>
  supplierProductsController.findBySupplier(req as ValidatedAuthRequest<typeof getBySupplierSchema>, res))

router.get('/product/:product_id', canView('supplier_products'), validateSchema(getByProductSchema), (req, res) =>
  supplierProductsController.findByProduct(req as ValidatedAuthRequest<typeof getByProductSchema>, res))

// List
router.get('/', canView('supplier_products'), queryMiddleware({ allowedSortFields: sortFields }), validateSchema(supplierProductListSchema), (req, res) =>
  supplierProductsController.list(req, res))

// CRUD
router.get('/:id', canView('supplier_products'), validateSchema(supplierProductIdSchema), (req, res) =>
  supplierProductsController.findById(req as ValidatedAuthRequest<typeof supplierProductIdSchema>, res))

router.post('/', canInsert('supplier_products'), validateSchema(createSupplierProductSchema), (req, res) =>
  supplierProductsController.create(req as ValidatedAuthRequest<typeof createSupplierProductSchema>, res))

router.put('/:id', canUpdate('supplier_products'), validateSchema(updateSupplierProductSchema), (req, res) =>
  supplierProductsController.update(req as ValidatedAuthRequest<typeof updateSupplierProductSchema>, res))

router.delete('/:id', canDelete('supplier_products'), validateSchema(supplierProductIdSchema), (req, res) =>
  supplierProductsController.delete(req as ValidatedAuthRequest<typeof supplierProductIdSchema>, res))

// Bulk
router.post('/bulk/delete', canDelete('supplier_products'), validateSchema(bulkDeleteSchema), (req, res) =>
  supplierProductsController.bulkDelete(req as ValidatedAuthRequest<typeof bulkDeleteSchema>, res))

router.post('/bulk/restore', canUpdate('supplier_products'), validateSchema(bulkDeleteSchema), (req, res) =>
  supplierProductsController.bulkRestore(req as ValidatedAuthRequest<typeof bulkDeleteSchema>, res))

// Restore single
router.post('/:id/restore', canUpdate('supplier_products'), validateSchema(supplierProductIdSchema), (req, res) =>
  supplierProductsController.restore(req as ValidatedAuthRequest<typeof supplierProductIdSchema>, res))

export default router
