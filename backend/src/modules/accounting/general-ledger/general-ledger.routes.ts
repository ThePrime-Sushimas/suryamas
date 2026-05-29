import { Router } from 'express'
import { generalLedgerController } from './general-ledger.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { generalLedgerQuerySchema } from './general-ledger.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('trial_balance'),
  validateSchema(generalLedgerQuerySchema),
  (req, res) => generalLedgerController.get(req, res)
)

export default router
