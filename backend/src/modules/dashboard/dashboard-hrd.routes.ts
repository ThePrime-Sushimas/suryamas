import { Router } from 'express'
import { dashboardHrdController } from './dashboard-hrd.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView } from '../../middleware/permission.middleware'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/hrd-summary', canView('dashboard_hrd'), (req, res) =>
  dashboardHrdController.getSummary(req, res))

export default router
