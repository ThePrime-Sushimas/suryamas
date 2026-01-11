import { Router, Response } from 'express'
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
import { SUPPLIER_PRODUCT_LIMITS } from './supplier-products.constants'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

// Register module permissions
PermissionService.registerModule('supplier_products', 'Supplier Product Management').catch(() => {})

// Apply common middleware
router.use(authenticate, resolveBranchContext)

// Apply rate limiting
router.use(supplierProductsRateLimit)

// Routes with specific validation and permissions

/**
 * GET /supplier-products/options/active
 * Get active supplier products for dropdown/options
 */
router.get('/options/active', 
  canView('supplier_products'), 
  (req: any, res: Response) => supplierProductsController.getActiveOptions(req, res)
)

/**
 * GET /supplier-products/export
 * Export supplier products to CSV
 */
router.get('/export',
  canView('supplier_products'),
  (req: any, res: Response) => supplierProductsController.exportCSV(req, res)
)

/**
 * GET /supplier-products/supplier/:supplier_id
 * Get supplier products by supplier ID
 */
router.get('/supplier/:supplier_id', 
  canView('supplier_products'),
  validateSchema(getBySupplierSchema),
  (req: any, res: Response) => supplierProductsController.findBySupplier(req, res)
)

/**
 * GET /supplier-products/product/:product_id
 * Get supplier products by product ID
 */
router.get('/product/:product_id', 
  canView('supplier_products'),
  validateSchema(getByProductSchema),
  (req: any, res: Response) => supplierProductsController.findByProduct(req, res)
)

/**
 * GET /supplier-products
 * List supplier products with pagination and filtering
 */
router.get('/', 
  canView('supplier_products'), 
  queryMiddleware({
    allowedSortFields: ['supplier_id', 'product_id', 'price', 'created_at', 'updated_at', 'id']
  }),
  validateSchema(supplierProductListSchema),
  (req: any, res: Response) => supplierProductsController.list(req, res)
)

/**
 * GET /supplier-products/:id
 * Get supplier product by ID
 */
router.get('/:id', 
  canView('supplier_products'),
  validateSchema(supplierProductIdSchema),
  (req: any, res: Response) => supplierProductsController.findById(req, res)
)

/**
 * POST /supplier-products
 * Create new supplier product
 */
router.post('/', 
  canInsert('supplier_products'),
  validateSchema(createSupplierProductSchema),
  supplierProductsController.create
)

/**
 * POST /supplier-products/bulk/delete
 * Bulk delete supplier products
 */
router.post('/bulk/delete', 
  canDelete('supplier_products'),
  validateSchema(bulkDeleteSchema),
  supplierProductsController.bulkDelete
)

/**
 * POST /supplier-products/bulk/restore
 * Bulk restore supplier products
 */
router.post('/bulk/restore',
  canUpdate('supplier_products'),
  validateSchema(bulkDeleteSchema),
  supplierProductsController.bulkRestore
)

/**
 * PUT /supplier-products/:id
 * Update supplier product
 */
router.put('/:id', 
  canUpdate('supplier_products'),
  validateSchema(updateSupplierProductSchema),
  supplierProductsController.update
)

/**
 * DELETE /supplier-products/:id
 * Delete supplier product
 */
router.delete('/:id', 
  canDelete('supplier_products'),
  validateSchema(supplierProductIdSchema),
  (req: any, res: Response) => supplierProductsController.delete(req, res)
)

/**
 * POST /supplier-products/:id/restore
 * Restore deleted supplier product
 */
router.post('/:id/restore',
  canUpdate('supplier_products'),
  validateSchema(supplierProductIdSchema),
  (req: any, res: Response) => supplierProductsController.restore(req, res)
)

export default router