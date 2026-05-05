import { Router } from 'express'
import { dailyLedgerController } from './daily-ledger.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { dailyLedgerQuerySchema } from './daily-ledger.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('trial_balance'),
  validateSchema(dailyLedgerQuerySchema),
  (req, res) => dailyLedgerController.get(req, res)
)

export default router
