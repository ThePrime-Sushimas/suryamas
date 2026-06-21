import { Router } from 'express'
import { inventoryReconciliationController } from './inventory-reconciliation.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { inventoryReconciliationQuerySchema } from './inventory-reconciliation.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('trial_balance'),
  validateSchema(inventoryReconciliationQuerySchema),
  (req, res) => inventoryReconciliationController.get(req, res)
)

export default router
