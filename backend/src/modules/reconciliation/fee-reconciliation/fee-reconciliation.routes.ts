/**
 * Fee Reconciliation Routes
 * Express routes with validation middleware
 * Follows same pattern as bank-reconciliation.routes.ts
 */

import { Router } from 'express'
import { feeReconciliationController } from './fee-reconciliation.controller'
import { 
  reconcileDailySchema,
  dailySummaryQuerySchema 
} from './fee-reconciliation.schema'
import { validateSchema } from '../../../middleware/validation.middleware'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert } from '../../../middleware/permission.middleware'
import { PermissionService } from '../../../services/permission.service'

// Register module in permission system
PermissionService.registerModule(
  'fee_reconciliation',
  'Fee Reconciliation Management',
).catch(() => {})

const router = Router()

// All routes require authentication and branch context
router.use(authenticate, resolveBranchContext)

// POST /reconciliation/fee/daily
// Reconcile all payment methods for company on specific date
router.post(
  '/daily',
  canInsert('fee_reconciliation'),
  validateSchema(reconcileDailySchema),
  (req, res) => feeReconciliationController.reconcileDaily(req, res)
)


// GET /reconciliation/fee/daily-summary
// Get reconciliation summary for date range
router.get(
  '/daily-summary',
  canView('fee_reconciliation'),
  validateSchema(dailySummaryQuerySchema),
  (req, res) => feeReconciliationController.getDailySummary(req, res)
)

// GET /reconciliation/fee/discrepancies
// Get transactions with fee discrepancies for review
router.get(
  '/discrepancies',
  canView('fee_reconciliation'),
  (req, res) => feeReconciliationController.getDiscrepancies(req, res)
)

export { router as feeReconciliationRoutes }
