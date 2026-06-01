import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete, canRelease } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { stockAdjustmentsController } from './stock-adjustments.controller'
import {
  adjustmentIdSchema, adjustmentListSchema, createAdjustmentSchema, cancelAdjustmentSchema,
} from './stock-adjustments.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('stock_adjustments', 'Stock Adjustments (Waste & Breakdown)').catch((err) => {
  console.error('Failed to register stock_adjustments module:', err instanceof Error ? err.message : err)
})

const router = Router()
router.use(authenticate, resolveBranchContext)

router.get('/', canView('stock_adjustments'), validateSchema(adjustmentListSchema), (req, res) => stockAdjustmentsController.list(req, res))
router.get('/:id', canView('stock_adjustments'), validateSchema(adjustmentIdSchema), (req, res) => stockAdjustmentsController.getById(req, res))
router.post('/', canInsert('stock_adjustments'), validateSchema(createAdjustmentSchema), (req, res) => stockAdjustmentsController.create(req, res))
router.post('/:id/confirm', canUpdate('stock_adjustments'), validateSchema(adjustmentIdSchema), (req, res) => stockAdjustmentsController.confirm(req, res))
router.post('/:id/cancel', canUpdate('stock_adjustments'), validateSchema(cancelAdjustmentSchema), (req, res) => stockAdjustmentsController.cancel(req, res))
router.post('/:id/journal', canRelease('stock_adjustments'), validateSchema(adjustmentIdSchema), (req, res) => stockAdjustmentsController.generateJournal(req, res))
router.delete('/:id', canDelete('stock_adjustments'), validateSchema(adjustmentIdSchema), (req, res) => stockAdjustmentsController.softDelete(req, res))
router.delete('/:id/journal', canRelease('stock_adjustments'), validateSchema(adjustmentIdSchema), (req, res) => stockAdjustmentsController.deleteJournal(req, res))

export default router
