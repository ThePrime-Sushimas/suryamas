import { Router } from 'express'
import { trialBalanceController } from './trial-balance.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { trialBalanceQuerySchema } from './trial-balance.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('trial_balance'),
  validateSchema(trialBalanceQuerySchema),
  (req, res) => trialBalanceController.get(req, res)
)

export default router
