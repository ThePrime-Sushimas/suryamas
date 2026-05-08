import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { cogsBreakdownController } from './cogs-breakdown.controller'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('cogs_breakdown', 'COGS Breakdown Analysis').catch((err) => {
  console.error('Failed to register cogs_breakdown module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('cogs_breakdown'), (req, res) => cogsBreakdownController.getBreakdown(req, res))
router.get('/menus', canView('cogs_breakdown'), (req, res) => cogsBreakdownController.getMenus(req, res))

export default router
