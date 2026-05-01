import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { PermissionService } from '../../services/permission.service'
import * as controller from './monitoring.controller'

const router = Router()

PermissionService.registerModule('monitoring', 'Monitoring & Audit').catch((err) => {
  console.error('Failed to register monitoring module:', err instanceof Error ? err.message : err)
})

router.use(authenticate, resolveBranchContext)

// Error/audit logging (no permission check — for reporting from frontend)
router.post('/errors', (req, res) => controller.logErrorReport(req, res))
router.post('/audit', (req, res) => controller.logAuditEntry(req, res))

// Protected routes
router.get('/errors/stats', canView('monitoring'), (req, res) => controller.getErrorStats(req, res))
router.get('/errors/trend', canView('monitoring'), (req, res) => controller.getErrorTrend(req, res))
router.get('/errors/grouped', canView('monitoring'), (req, res) => controller.getErrorGrouped(req, res))
router.get('/errors', canView('monitoring'), queryMiddleware({}), (req, res) => controller.getErrorLogs(req, res))
router.get('/audit', canView('monitoring'), queryMiddleware({}), (req, res) => controller.getAuditLogs(req, res))

// Bulk actions
router.post('/errors/bulk', canView('monitoring'), (req, res) => controller.bulkActionErrorLogs(req, res))
router.post('/audit/bulk', canView('monitoring'), (req, res) => controller.bulkActionAuditLogs(req, res))

export default router
