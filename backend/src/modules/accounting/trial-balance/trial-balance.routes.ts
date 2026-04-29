import { Router } from 'express'
import { trialBalanceController } from './trial-balance.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { trialBalanceQuerySchema } from './trial-balance.schema'
import type { AuthenticatedQueryRequest } from '../../../types/request.types'

const router = Router()

router.use(authenticate, resolveBranchContext)

/**
 * GET /accounting/trial-balance
 * Query params: company_id, date_from, date_to, branch_id (optional)
 */
router.get(
  '/',
  canView('trial_balance'),
  validateSchema(trialBalanceQuerySchema),
  (req, res) => trialBalanceController.get(req as any, res)
)

export default router
