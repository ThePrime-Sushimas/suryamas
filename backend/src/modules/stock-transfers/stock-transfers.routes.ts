import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete, canRelease } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { stockTransfersController } from './stock-transfers.controller'
import {
  transferIdSchema, transferListSchema, createTransferSchema, cancelTransferSchema, returnLoanSchema, updateTransferSchema,
} from './stock-transfers.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('stock_transfers', 'Stock Transfers').catch((err) => {
  console.error('Failed to register stock_transfers module:', err instanceof Error ? err.message : err)
})

const router = Router()
router.use(authenticate, resolveBranchContext)

// List
router.get('/', canView('stock_transfers'), validateSchema(transferListSchema), (req, res) => stockTransfersController.list(req, res))

// Detail
router.get('/:id', canView('stock_transfers'), validateSchema(transferIdSchema), (req, res) => stockTransfersController.getById(req, res))

// Create
router.post('/', canInsert('stock_transfers'), validateSchema(createTransferSchema), (req, res) => stockTransfersController.create(req, res))

// Update (DRAFT only)
router.put('/:id', canUpdate('stock_transfers'), validateSchema(updateTransferSchema), (req, res) => stockTransfersController.update(req, res))

// Confirm
router.post('/:id/confirm', canUpdate('stock_transfers'), validateSchema(transferIdSchema), (req, res) => stockTransfersController.confirm(req, res))

// Return loan
router.post('/:id/return', canUpdate('stock_transfers'), validateSchema(returnLoanSchema), (req, res) => stockTransfersController.returnLoan(req, res))

// Cancel
router.post('/:id/cancel', canUpdate('stock_transfers'), validateSchema(cancelTransferSchema), (req, res) => stockTransfersController.cancel(req, res))

// Delete
router.delete('/:id', canDelete('stock_transfers'), validateSchema(transferIdSchema), (req, res) => stockTransfersController.softDelete(req, res))

// Delete journals (release permission only)
router.delete('/:id/journals', canRelease('stock_transfers'), validateSchema(transferIdSchema), (req, res) => stockTransfersController.deleteJournals(req, res))

export default router
