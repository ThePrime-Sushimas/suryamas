import { Router } from 'express'
import { accountingPurposeAccountsController } from './accounting-purpose-accounts.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { exportLimiter, createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { PermissionService } from '../../../services/permission.service'
import { 
  createAccountingPurposeAccountSchema, 
  updateAccountingPurposeAccountSchema, 
  accountingPurposeAccountIdSchema,
  bulkCreateAccountingPurposeAccountSchema,
  bulkRemoveAccountingPurposeAccountSchema,
  bulkUpdateStatusSchema
} from './accounting-purpose-accounts.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'

// Register module permissions
PermissionService.registerModule('accounting-purpose-accounts', 'Accounting Purpose Accounts Management').catch((error) => {
  console.error('Failed to register accounting-purpose-accounts module:', error.message)
})

const router = Router()

// Apply authentication and branch context to all routes
router.use(authenticate, resolveBranchContext)

// List routes
router.get('/', canView('accounting-purpose-accounts'), queryMiddleware({
  allowedSortFields: ['priority', 'side', 'created_at', 'updated_at', 'account_name'],
}), (req, res) => 
  accountingPurposeAccountsController.list(req as AuthenticatedQueryRequest, res))

// Export routes with rate limiting
router.get('/export/token', canView('accounting-purpose-accounts'), exportLimiter, (req, res) => 
  accountingPurposeAccountsController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('accounting-purpose-accounts'), exportLimiter, (req, res) => 
  accountingPurposeAccountsController.exportData(req as AuthenticatedQueryRequest, res))

// Bulk operations with rate limiting
router.post('/bulk/create', canInsert('accounting-purpose-accounts'), createRateLimit, validateSchema(bulkCreateAccountingPurposeAccountSchema), (req, res) => 
  accountingPurposeAccountsController.bulkCreate(req as ValidatedAuthRequest<typeof bulkCreateAccountingPurposeAccountSchema>, res))

router.post('/bulk/remove', canDelete('accounting-purpose-accounts'), updateRateLimit, validateSchema(bulkRemoveAccountingPurposeAccountSchema), (req, res) => 
  accountingPurposeAccountsController.bulkRemove(req as ValidatedAuthRequest<typeof bulkRemoveAccountingPurposeAccountSchema>, res))

router.post('/bulk/status', canUpdate('accounting-purpose-accounts'), updateRateLimit, validateSchema(bulkUpdateStatusSchema), (req, res) => 
  accountingPurposeAccountsController.bulkUpdateStatus(req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res))

// CRUD operations
router.post('/', canInsert('accounting-purpose-accounts'), validateSchema(createAccountingPurposeAccountSchema), (req, res) => 
  accountingPurposeAccountsController.create(req as ValidatedAuthRequest<typeof createAccountingPurposeAccountSchema>, res))

router.get('/:id', canView('accounting-purpose-accounts'), validateSchema(accountingPurposeAccountIdSchema), (req, res) => 
  accountingPurposeAccountsController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('accounting-purpose-accounts'), validateSchema(updateAccountingPurposeAccountSchema), (req, res) => 
  accountingPurposeAccountsController.update(req as ValidatedAuthRequest<typeof updateAccountingPurposeAccountSchema>, res))

router.delete('/:id', canDelete('accounting-purpose-accounts'), validateSchema(accountingPurposeAccountIdSchema), (req, res) => 
  accountingPurposeAccountsController.delete(req as AuthenticatedRequest, res))

export default router