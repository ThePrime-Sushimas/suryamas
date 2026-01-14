import { Router } from 'express'
import { fiscalPeriodsController } from './fiscal-periods.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { exportLimiter } from '../../../middleware/rateLimiter.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { PermissionService } from '../../../services/permission.service'
import { 
  createFiscalPeriodSchema, 
  updateFiscalPeriodSchema, 
  closePeriodSchema,
  fiscalPeriodIdSchema, 
  bulkDeleteSchema,
  bulkRestoreSchema
} from './fiscal-periods.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import rateLimit from 'express-rate-limit'

PermissionService.registerModule('fiscal-periods', 'Fiscal Periods Management').catch((error) => {
  console.error('Failed to register fiscal-periods module:', error.message)
})

const bulkOperationLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many bulk operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('fiscal-periods'), queryMiddleware({
  allowedSortFields: ['period', 'fiscal_year', 'is_open', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  fiscalPeriodsController.list(req as AuthenticatedQueryRequest, res))

router.get('/export/token', canView('fiscal-periods'), exportLimiter, (req, res) => 
  fiscalPeriodsController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('fiscal-periods'), exportLimiter, (req, res) => 
  fiscalPeriodsController.exportData(req as AuthenticatedQueryRequest, res))

router.post('/bulk/delete', canDelete('fiscal-periods'), bulkOperationLimit, validateSchema(bulkDeleteSchema), (req, res) => 
  fiscalPeriodsController.bulkDelete(req as ValidatedAuthRequest<typeof bulkDeleteSchema>, res))

router.post('/bulk/restore', canUpdate('fiscal-periods'), bulkOperationLimit, validateSchema(bulkRestoreSchema), (req, res) => 
  fiscalPeriodsController.bulkRestore(req as ValidatedAuthRequest<typeof bulkRestoreSchema>, res))

router.post('/', canInsert('fiscal-periods'), validateSchema(createFiscalPeriodSchema), (req, res) => 
  fiscalPeriodsController.create(req as ValidatedAuthRequest<typeof createFiscalPeriodSchema>, res))

router.get('/:id', canView('fiscal-periods'), validateSchema(fiscalPeriodIdSchema), (req, res) => 
  fiscalPeriodsController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('fiscal-periods'), validateSchema(updateFiscalPeriodSchema), (req, res) => 
  fiscalPeriodsController.update(req as ValidatedAuthRequest<typeof updateFiscalPeriodSchema>, res))

router.post('/:id/close', canUpdate('fiscal-periods'), validateSchema(closePeriodSchema), (req, res) => 
  fiscalPeriodsController.closePeriod(req as ValidatedAuthRequest<typeof closePeriodSchema>, res))

router.delete('/:id', canDelete('fiscal-periods'), validateSchema(fiscalPeriodIdSchema), (req, res) => 
  fiscalPeriodsController.delete(req as AuthenticatedRequest, res))

router.post('/:id/restore', canUpdate('fiscal-periods'), validateSchema(fiscalPeriodIdSchema), (req, res) => 
  fiscalPeriodsController.restore(req as AuthenticatedRequest, res))

export default router
