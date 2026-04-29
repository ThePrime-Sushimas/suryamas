import { Router } from 'express'
import { incomeStatementController } from './income-statement.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { incomeStatementQuerySchema } from './income-statement.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('income_statement'),
  validateSchema(incomeStatementQuerySchema),
  (req, res) => incomeStatementController.get(req as any, res)
)

export default router
