import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { wasteReportController } from './waste-report.controller'
import { wasteReportQuerySchema, wasteReportByBranchSchema, wasteReportCompareSchema } from './waste-report.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('waste_report', 'Waste Report').catch((err) => {
  console.error('Failed to register waste_report module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('waste_report'), validateSchema(wasteReportQuerySchema), (req, res) =>
  wasteReportController.getReport(req, res),
)
router.get('/summary', canView('waste_report'), validateSchema(wasteReportQuerySchema), (req, res) =>
  wasteReportController.getSummary(req, res),
)
router.get('/by-item', canView('waste_report'), validateSchema(wasteReportQuerySchema), (req, res) =>
  wasteReportController.getByItem(req, res),
)
router.get('/by-reason', canView('waste_report'), validateSchema(wasteReportQuerySchema), (req, res) =>
  wasteReportController.getByReason(req, res),
)
router.get('/monthly-selisih', canView('waste_report'), validateSchema(wasteReportQuerySchema), (req, res) =>
  wasteReportController.getMonthlySelisih(req, res),
)
router.get('/by-branch', canView('waste_report'), validateSchema(wasteReportByBranchSchema), (req, res) =>
  wasteReportController.getByBranch(req, res),
)
router.get('/compare', canView('waste_report'), validateSchema(wasteReportCompareSchema), (req, res) =>
  wasteReportController.compare(req, res),
)

export default router
