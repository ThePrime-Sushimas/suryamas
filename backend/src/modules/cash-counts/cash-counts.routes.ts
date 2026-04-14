import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { cashCountsController } from './cash-counts.controller'
import { PermissionService } from '../../services/permission.service'
import {
  previewSchema,
  createCashCountSchema,
  cashCountIdSchema,
  updatePhysicalCountSchema,
  depositSchema,
  cashCountListQuerySchema,
} from './cash-counts.schema'

const router = Router()

PermissionService.registerModule('cash_counts', 'Cash Count Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

// Preview (working sheet — no records created)
router.get('/preview', canView('cash_counts'), validateSchema(previewSchema), cashCountsController.preview)

// List
router.get('/', canView('cash_counts'), validateSchema(cashCountListQuerySchema), cashCountsController.list)

// Get by ID
router.get('/:id', canView('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.findById)

// Create (single branch — called per row from preview)
router.post('/', canInsert('cash_counts'), validateSchema(createCashCountSchema), cashCountsController.create)

// Physical count (OPEN → COUNTED)
router.put('/:id/count', canUpdate('cash_counts'), validateSchema(updatePhysicalCountSchema), cashCountsController.updatePhysicalCount)

// Deposit (COUNTED → DEPOSITED)
router.put('/:id/deposit', canUpdate('cash_counts'), validateSchema(depositSchema), cashCountsController.deposit)

// Close (DEPOSITED → CLOSED)
router.post('/:id/close', canUpdate('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.close)

// Delete (only OPEN)
router.delete('/:id', canDelete('cash_counts'), validateSchema(cashCountIdSchema), cashCountsController.delete)

export default router
