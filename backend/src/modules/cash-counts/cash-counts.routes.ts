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
  depositListQuerySchema, capitalReportSchema, cashCountListQuerySchema,
} from './cash-counts.schema'
import multer from 'multer'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    cb(null, allowed.includes(file.mimetype))
  },
})

const router = Router()

PermissionService.registerModule('cash_counts', 'Cash Count Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

// Preview
router.get('/preview', canView('cash_counts'), validateSchema(previewSchema), (req, res) => cashCountsController.preview(req, res))

// Report
router.get('/report/capital', canRelease('cash_counts'), validateSchema(capitalReportSchema), (req, res) => cashCountsController.capitalReport(req, res))

// Deposits
router.get('/deposits', canView('cash_counts'), validateSchema(depositListQuerySchema), (req, res) => cashCountsController.listDeposits(req, res))
router.post('/deposits', requireWriteAccess, canInsert('cash_counts'), validateSchema(createDepositSchema), (req, res) => cashCountsController.createDeposit(req, res))
router.get('/deposits/:id', canView('cash_counts'), validateSchema(depositIdSchema), (req, res) => cashCountsController.getDeposit(req, res))
router.post('/deposits/:id/confirm', requireWriteAccess, canUpdate('cash_counts'), validateSchema(depositIdSchema), uploadMiddleware.single('proof'), (req, res) => cashCountsController.confirmDeposit(req, res))
router.post('/deposits/:id/revert', requireWriteAccess, canUpdate('cash_counts'), validateSchema(depositIdSchema), (req, res) => cashCountsController.revertDeposit(req, res))
router.delete('/deposits/:id', requireWriteAccess, canDelete('cash_counts'), validateSchema(depositIdSchema), (req, res) => cashCountsController.deleteDeposit(req, res))

// Cash counts
router.get('/', canView('cash_counts'), validateSchema(cashCountListQuerySchema), (req, res) => cashCountsController.list(req, res))
router.get('/:id', canView('cash_counts'), validateSchema(cashCountIdSchema), (req, res) => cashCountsController.findById(req, res))
router.post('/', requireWriteAccess, canInsert('cash_counts'), validateSchema(createCashCountSchema), (req, res) => cashCountsController.create(req, res))
router.put('/:id/count', requireWriteAccess, canUpdate('cash_counts'), validateSchema(updatePhysicalCountSchema), (req, res) => cashCountsController.updatePhysicalCount(req, res))
router.post('/:id/close', requireWriteAccess, canUpdate('cash_counts'), validateSchema(cashCountIdSchema), (req, res) => cashCountsController.close(req, res))
router.delete('/:id', requireWriteAccess, canDelete('cash_counts'), validateSchema(cashCountIdSchema), (req, res) => cashCountsController.delete(req, res))

export default router
