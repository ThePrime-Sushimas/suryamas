import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete, canRelease } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { cashCountsController } from './cash-counts.controller'
import { PermissionService } from '../../services/permission.service'
import {
  previewSchema, createCashCountSchema, cashCountIdSchema,
  updatePhysicalCountSchema, createDepositSchema, depositIdSchema,
  confirmDepositSchema, depositListQuerySchema, capitalReportSchema, cashCountListQuerySchema,
} from './cash-counts.schema'
import multer from 'multer'

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    cb(null, allowed.includes(file.mimetype))
  },
})

const router = Router()

PermissionService.registerModule('cash_counts', 'Cash Count Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

// Preview
router.get('/preview', canView('cash_counts'), validateSchema(previewSchema), cashCountsController.preview)

// Report — tambahan modal (release permission only)
router.get('/report/capital', canRelease('cash_counts'), validateSchema(capitalReportSchema), cashCountsController.capitalReport)

// Deposits
router.get('/deposits', canView('cash_counts'), validateSchema(depositListQuerySchema), cashCountsController.listDeposits)
router.post('/deposits', canInsert('cash_counts'), validateSchema(createDepositSchema), cashCountsController.createDeposit)
router.get('/deposits/:id', canView('cash_counts'), validateSchema(depositIdSchema), cashCountsController.getDeposit)
router.post('/deposits/:id/confirm', canUpdate('cash_counts'), uploadMiddleware.single('proof'), cashCountsController.confirmDeposit)
router.post('/deposits/:id/revert', canUpdate('cash_counts'), validateSchema(depositIdSchema), cashCountsController.revertDeposit)
router.delete('/deposits/:id', canDelete('cash_counts'), validateSchema(depositIdSchema), cashCountsController.deleteDeposit)

// Cash counts
router.get('/', canView('cash_counts'), validateSchema(cashCountListQuerySchema), cashCountsController.list)
router.get('/:id', canView('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.findById)
router.post('/', canInsert('cash_counts'), validateSchema(createCashCountSchema), cashCountsController.create)
router.put('/:id/count', canUpdate('cash_counts'), validateSchema(updatePhysicalCountSchema), cashCountsController.updatePhysicalCount)
router.post('/:id/close', canUpdate('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.close)
router.delete('/:id', canDelete('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.delete)

export default router
