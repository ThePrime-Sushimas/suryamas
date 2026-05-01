import { Router } from 'express'
import { balanceSheetController } from './balance-sheet.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { balanceSheetQuerySchema } from './balance-sheet.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('balance_sheet'),
  validateSchema(balanceSheetQuerySchema),
  (req, res) => balanceSheetController.get(req, res)
)

export default router
