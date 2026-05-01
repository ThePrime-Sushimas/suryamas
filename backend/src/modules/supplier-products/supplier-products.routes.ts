import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
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

PermissionService.registerModule('supplier_products', 'Supplier Product Management')
  .catch((err) => console.error('Failed to register supplier_products module:', err))

router.use(authenticate, resolveBranchContext)
router.use(supplierProductsRateLimit)

const sortFields = ['supplier_id', 'product_id', 'price', 'created_at', 'updated_at', 'id']

router.get('/options/active', canView('supplier_products'), (req, res) =>
  supplierProductsController.getActiveOptions(req, res))

router.get('/export', canView('supplier_products'), (req, res) =>
  supplierProductsController.exportCSV(req, res))

router.get('/supplier/:supplier_id', canView('supplier_products'), validateSchema(getBySupplierSchema), (req, res) =>
  supplierProductsController.findBySupplier(req, res))

router.get('/product/:product_id', canView('supplier_products'), validateSchema(getByProductSchema), (req, res) =>
  supplierProductsController.findByProduct(req, res))

router.get('/', canView('supplier_products'), queryMiddleware({ allowedSortFields: sortFields }), validateSchema(supplierProductListSchema), (req, res) =>
  supplierProductsController.list(req, res))

router.get('/:id', canView('supplier_products'), validateSchema(supplierProductIdSchema), (req, res) =>
  supplierProductsController.findById(req, res))

router.post('/', canInsert('supplier_products'), validateSchema(createSupplierProductSchema), (req, res) =>
  supplierProductsController.create(req, res))

router.put('/:id', canUpdate('supplier_products'), validateSchema(updateSupplierProductSchema), (req, res) =>
  supplierProductsController.update(req, res))

router.delete('/:id', canDelete('supplier_products'), validateSchema(supplierProductIdSchema), (req, res) =>
  supplierProductsController.delete(req, res))

router.post('/bulk/delete', canDelete('supplier_products'), validateSchema(bulkDeleteSchema), (req, res) =>
  supplierProductsController.bulkDelete(req, res))

router.post('/bulk/restore', canUpdate('supplier_products'), validateSchema(bulkDeleteSchema), (req, res) =>
  supplierProductsController.bulkRestore(req, res))

router.post('/:id/restore', canUpdate('supplier_products'), validateSchema(supplierProductIdSchema), (req, res) =>
  supplierProductsController.restore(req, res))

export default router
