import { Router } from 'express'
import { accountingPurposesController } from './accounting-purposes.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { exportLimiter } from '../../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { PermissionService } from '../../../services/permission.service'
import { 
  createAccountingPurposeSchema, 
  updateAccountingPurposeSchema, 
  accountingPurposeIdSchema, 
  bulkUpdateStatusSchema, 
  bulkDeleteSchema 
} from './accounting-purposes.schema'
import rateLimit from 'express-rate-limit'

// Register module permissions
PermissionService.registerModule('accounting_purposes', 'Accounting Purposes Management').catch((error) => {
  console.error('Failed to register accounting_purposes module:', error.message)
})

// Rate limiters for expensive operations
const bulkOperationLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 bulk operations per 5 minutes
  message: 'Too many bulk operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

const router = Router()

// Apply authentication and branch context to all routes
router.use(authenticate, resolveBranchContext)

// List and search routes
router.get('/', canView('accounting_purposes'), queryMiddleware({
  allowedSortFields: ['purpose_code', 'purpose_name', 'applied_to', 'is_active', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  accountingPurposesController.list(req, res))

router.get('/search', canView('accounting_purposes'), queryMiddleware({
  allowedSortFields: ['purpose_code', 'purpose_name', 'applied_to', 'is_active', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  accountingPurposesController.search(req, res))

// Filter options
router.get('/filter-options', canView('accounting_purposes'), (req, res) => 
  accountingPurposesController.getFilterOptions(req, res))

// Export routes with rate limiting
router.get('/export/token', canView('accounting_purposes'), exportLimiter, (req, res) => 
  accountingPurposesController.generateExportToken(req, res))

router.get('/export', canView('accounting_purposes'), exportLimiter, (req, res) => 
  accountingPurposesController.exportData(req, res))

// Import routes
router.post('/import/preview', canInsert('accounting_purposes'), (req, res) => 
  accountingPurposesController.previewImport(req, res))

router.post('/import', canInsert('accounting_purposes'), (req, res) => 
  accountingPurposesController.importData(req, res))

// Bulk operations with rate limiting
router.post('/bulk/status', canUpdate('accounting_purposes'), bulkOperationLimit, validateSchema(bulkUpdateStatusSchema), (req, res) => 
  accountingPurposesController.bulkUpdateStatus(req, res))

router.post('/bulk/delete', canDelete('accounting_purposes'), bulkOperationLimit, validateSchema(bulkDeleteSchema), (req, res) => 
  accountingPurposesController.bulkDelete(req, res))

router.post('/bulk/restore', canUpdate('accounting_purposes'), bulkOperationLimit, validateSchema(bulkDeleteSchema), (req, res) => 
  accountingPurposesController.bulkRestore(req, res))

// CRUD operations
router.post('/', canInsert('accounting_purposes'), validateSchema(createAccountingPurposeSchema), (req, res) => 
  accountingPurposesController.create(req, res))

router.get('/:id', canView('accounting_purposes'), validateSchema(accountingPurposeIdSchema), (req, res) => 
  accountingPurposesController.getById(req, res))

router.put('/:id', canUpdate('accounting_purposes'), validateSchema(updateAccountingPurposeSchema), (req, res) => 
  accountingPurposesController.update(req, res))

router.delete('/:id', canDelete('accounting_purposes'), validateSchema(accountingPurposeIdSchema), (req, res) => 
  accountingPurposesController.delete(req, res))

router.post('/:id/restore', canUpdate('accounting_purposes'), validateSchema(accountingPurposeIdSchema), (req, res) => 
  accountingPurposesController.restore(req, res))

export default router