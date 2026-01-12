import { Router } from 'express'
import { chartOfAccountsController } from './chart-of-accounts.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { exportLimiter } from '../../../middleware/rateLimiter.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { PermissionService } from '../../../services/permission.service'
import { 
  createChartOfAccountSchema, 
  updateChartOfAccountSchema, 
  chartOfAccountIdSchema, 
  bulkUpdateStatusSchema, 
  bulkDeleteSchema 
} from './chart-of-accounts.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import rateLimit from 'express-rate-limit'

// Register module permissions
PermissionService.registerModule('chart-of-accounts', 'Chart of Accounts Management').catch((error) => {
  console.error('Failed to register chart-of-accounts module:', error.message)
})

// Rate limiters for expensive operations
const treeRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many tree requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

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
router.get('/', canView('chart-of-accounts'), queryMiddleware({
  allowedSortFields: ['account_code', 'account_name', 'account_type', 'level', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  chartOfAccountsController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('chart-of-accounts'), queryMiddleware({
  allowedSortFields: ['account_code', 'account_name', 'account_type', 'level', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  chartOfAccountsController.search(req as AuthenticatedQueryRequest, res))

// Tree view with rate limiting
router.get('/tree', canView('chart-of-accounts'), treeRateLimit, (req, res) => 
  chartOfAccountsController.getTree(req as AuthenticatedRequest, res))

// Filter options
router.get('/filter-options', canView('chart-of-accounts'), (req, res) => 
  chartOfAccountsController.getFilterOptions(req as AuthenticatedRequest, res))

// Export routes with rate limiting
router.get('/export/token', canView('chart-of-accounts'), exportLimiter, (req, res) => 
  chartOfAccountsController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('chart-of-accounts'), exportLimiter, (req, res) => 
  chartOfAccountsController.exportData(req as AuthenticatedQueryRequest, res))

// Import routes
router.post('/import/preview', canInsert('chart-of-accounts'), (req, res) => 
  chartOfAccountsController.previewImport(req as AuthenticatedRequest, res))

router.post('/import', canInsert('chart-of-accounts'), (req, res) => 
  chartOfAccountsController.importData(req as AuthenticatedRequest, res))

// Bulk operations with rate limiting
router.post('/bulk/status', canUpdate('chart-of-accounts'), bulkOperationLimit, validateSchema(bulkUpdateStatusSchema), (req, res) => 
  chartOfAccountsController.bulkUpdateStatus(req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res))

router.post('/bulk/delete', canDelete('chart-of-accounts'), bulkOperationLimit, validateSchema(bulkDeleteSchema), (req, res) => 
  chartOfAccountsController.bulkDelete(req as ValidatedAuthRequest<typeof bulkDeleteSchema>, res))

// CRUD operations
router.post('/', canInsert('chart-of-accounts'), validateSchema(createChartOfAccountSchema), (req, res) => 
  chartOfAccountsController.create(req as ValidatedAuthRequest<typeof createChartOfAccountSchema>, res))

router.get('/:id', canView('chart-of-accounts'), validateSchema(chartOfAccountIdSchema), (req, res) => 
  chartOfAccountsController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('chart-of-accounts'), validateSchema(updateChartOfAccountSchema), (req, res) => 
  chartOfAccountsController.update(req as ValidatedAuthRequest<typeof updateChartOfAccountSchema>, res))

router.delete('/:id', canDelete('chart-of-accounts'), validateSchema(chartOfAccountIdSchema), (req, res) => 
  chartOfAccountsController.delete(req as AuthenticatedRequest, res))

export default router