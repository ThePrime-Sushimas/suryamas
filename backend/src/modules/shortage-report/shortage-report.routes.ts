import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { shortageReportController } from './shortage-report.controller'
import {
  shortageReportQuerySchema,
  shortageReportByEmployeeSchema,
  shortageDepartmentEmployeesSchema,
  shortageResolveSchema,
  shortageDeductionPaidSchema,
  shortageEditResolutionSchema,
} from './shortage-report.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('shortage_report', 'Shortage Report').catch((err) => {
  console.error('Failed to register shortage_report module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('shortage_report'), validateSchema(shortageReportQuerySchema), (req, res) =>
  shortageReportController.getReport(req, res),
)
router.get('/by-item', canView('shortage_report'), validateSchema(shortageReportQuerySchema), (req, res) =>
  shortageReportController.getByItem(req, res),
)
router.get('/by-employee', canView('shortage_report'), validateSchema(shortageReportByEmployeeSchema), (req, res) =>
  shortageReportController.getByEmployee(req, res),
)
router.get('/by-department', canView('shortage_report'), validateSchema(shortageReportByEmployeeSchema), (req, res) =>
  shortageReportController.getByDepartment(req, res),
)
router.get('/department-employees', canView('shortage_report'), validateSchema(shortageDepartmentEmployeesSchema), (req, res) =>
  shortageReportController.getDepartmentEmployees(req, res),
)
router.post('/resolve', requireWriteAccess, canUpdate('shortage_report'), validateSchema(shortageResolveSchema), (req, res) =>
  shortageReportController.resolve(req, res),
)
router.patch('/:id/deduction-paid', requireWriteAccess, canUpdate('shortage_report'), validateSchema(shortageDeductionPaidSchema), (req, res) =>
  shortageReportController.markDeductionPaid(req, res),
)
router.patch('/:id/edit-resolution', requireWriteAccess, canUpdate('shortage_report'), validateSchema(shortageEditResolutionSchema), (req, res) =>
  shortageReportController.editResolution(req, res),
)

export default router
