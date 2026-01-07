import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { rateLimit } from '../../middleware/rate-limit.middleware'
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
const supplierProductsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: SUPPLIER_PRODUCT_LIMITS.REQUEST_RATE_LIMIT,
  message: 'Too many requests to supplier-products API',
  keyGenerator: (req) => `${req.ip}-${(req as any).user?.id || 'anonymous'}`
})

router.use(supplierProductsRateLimit)

// Routes with specific validation and permissions

/**
 * GET /supplier-products/options/active
 * Get active supplier products for dropdown/options
 */
router.get('/options/active', 
  canView('supplier_products'), 
  (req, res) => supplierProductsController.getActiveOptions(req as AuthenticatedRequest, res)
)

/**
 * GET /supplier-products/supplier/:supplier_id
 * Get supplier products by supplier ID
 */
router.get('/supplier/:supplier_id', 
  canView('supplier_products'),
  validateSchema(getBySupplierSchema),
  (req, res) => supplierProductsController.findBySupplier(req as AuthenticatedRequest, res)
)

/**
 * GET /supplier-products/product/:product_id
 * Get supplier products by product ID
 */
router.get('/product/:product_id', 
  canView('supplier_products'),
  validateSchema(getByProductSchema),
  (req, res) => supplierProductsController.findByProduct(req as AuthenticatedRequest, res)
)

/**
 * GET /supplier-products
 * List supplier products with pagination and filtering
 */
router.get('/', 
  canView('supplier_products'), 
  paginationMiddleware, 
  sortMiddleware, 
  filterMiddleware,
  validateSchema(supplierProductListSchema),
  (req, res) => supplierProductsController.list(req as AuthenticatedQueryRequest, res)
)

/**
 * GET /supplier-products/:id
 * Get supplier product by ID
 */
router.get('/:id', 
  canView('supplier_products'),
  validateSchema(supplierProductIdSchema),
  (req, res) => supplierProductsController.findById(req as AuthenticatedRequest, res)
)

/**
 * POST /supplier-products
 * Create new supplier product
 */
router.post('/', 
  canInsert('supplier_products'),
  validateSchema(createSupplierProductSchema),
  (req, res) => supplierProductsController.create(req as AuthenticatedRequest, res)
)

/**
 * PUT /supplier-products/:id
 * Update supplier product
 */
router.put('/:id', 
  canUpdate('supplier_products'),
  validateSchema(updateSupplierProductSchema),
  (req, res) => supplierProductsController.update(req as AuthenticatedRequest, res)
)

/**
 * DELETE /supplier-products/:id
 * Delete supplier product
 */
router.delete('/:id', 
  canDelete('supplier_products'),
  validateSchema(supplierProductIdSchema),
  (req, res) => supplierProductsController.delete(req as AuthenticatedRequest, res)
)

/**
 * POST /supplier-products/bulk/delete
 * Bulk delete supplier products
 */
router.post('/bulk/delete', 
  canDelete('supplier_products'),
  validateSchema(bulkDeleteSchema),
  (req, res) => supplierProductsController.bulkDelete(req as AuthenticatedRequest, res)
)

export default router