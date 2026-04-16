import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { cashCountsController } from './cash-counts.controller'
import { PermissionService } from '../../services/permission.service'
import {
  previewSchema, createCashCountSchema, cashCountIdSchema,
  updatePhysicalCountSchema, createDepositSchema, depositIdSchema,
  confirmDepositSchema, depositListQuerySchema, cashCountListQuerySchema,
} from './cash-counts.schema'

const router = Router()

PermissionService.registerModule('cash_counts', 'Cash Count Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

// Preview
router.get('/preview', canView('cash_counts'), validateSchema(previewSchema), cashCountsController.preview)

// Deposits
router.get('/deposits', canView('cash_counts'), validateSchema(depositListQuerySchema), cashCountsController.listDeposits)
router.post('/deposits', canInsert('cash_counts'), validateSchema(createDepositSchema), cashCountsController.createDeposit)
router.get('/deposits/:id', canView('cash_counts'), validateSchema(depositIdSchema), cashCountsController.getDeposit)
router.post('/deposits/:id/confirm', canUpdate('cash_counts'), validateSchema(confirmDepositSchema), cashCountsController.confirmDeposit)
router.delete('/deposits/:id', canDelete('cash_counts'), validateSchema(depositIdSchema), cashCountsController.deleteDeposit)

// Cash counts
router.get('/', canView('cash_counts'), validateSchema(cashCountListQuerySchema), cashCountsController.list)
router.get('/:id', canView('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.findById)
router.post('/', canInsert('cash_counts'), validateSchema(createCashCountSchema), cashCountsController.create)
router.put('/:id/count', canUpdate('cash_counts'), validateSchema(updatePhysicalCountSchema), cashCountsController.updatePhysicalCount)
router.post('/:id/close', canUpdate('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.close)
router.delete('/:id', canDelete('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.delete)

export default router
