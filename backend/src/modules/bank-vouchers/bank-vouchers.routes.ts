import { Router } from 'express'
import { bankVouchersController } from './bank-vouchers.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import {
  bankVoucherPreviewSchema,
  bankVoucherSummarySchema,
} from './bank-vouchers.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

// ============================================================
// Register module permissions
// ============================================================

PermissionService.registerModule('bank_vouchers', 'Bank Vouchers').catch((error) => {
  console.error('Failed to register bank_vouchers module:', error.message)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// ============================================================
// GET /api/v1/bank-vouchers/health
// ============================================================

router.get(
  '/health',
  (req, res) => bankVouchersController.health(req as AuthenticatedRequest, res)
)

// ============================================================
// GET /api/v1/bank-vouchers/bank-accounts
// Dropdown list bank account untuk filter
// ============================================================

router.get(
  '/bank-accounts',
  canView('bank_vouchers'),
  (req, res) => bankVouchersController.getBankAccounts(req as AuthenticatedRequest, res)
)

// ============================================================
// GET /api/v1/bank-vouchers/preview
// Preview buku mutasi bank on-the-fly
// Query: period_month, period_year, branch_id?, bank_account_id?, voucher_type?
// ============================================================

router.get(
  '/preview',
  canView('bank_vouchers'),
  validateSchema(bankVoucherPreviewSchema),
  (req, res) => bankVouchersController.preview(req as AuthenticatedRequest, res)
)

// ============================================================
// GET /api/v1/bank-vouchers/summary
// Totals + running balance per periode
// Query: period_month, period_year, branch_id?
// ============================================================

router.get(
  '/summary',
  canView('bank_vouchers'),
  validateSchema(bankVoucherSummarySchema),
  (req, res) => bankVouchersController.summary(req as AuthenticatedRequest, res)
)

// ============================================================
// PHASE 2 PLACEHOLDERS (uncomment setelah phase 2 siap)
// ============================================================

// POST /confirm — freeze voucher ke DB
// router.post('/confirm', canInsert('bank_vouchers'), validateSchema(bankVoucherConfirmSchema),
//   (req, res) => bankVouchersController.confirm(req as AuthenticatedRequest, res))

// GET /:id — get saved voucher detail
// router.get('/:id', canView('bank_vouchers'),
//   (req, res) => bankVouchersController.getById(req as AuthenticatedRequest, res))

// PUT /:id — adjust voucher lines
// router.put('/:id', canUpdate('bank_vouchers'), validateSchema(bankVoucherAdjustSchema),
//   (req, res) => bankVouchersController.adjust(req as AuthenticatedRequest, res))

// DELETE /:id — void voucher
// router.delete('/:id', canDelete('bank_vouchers'),
//   (req, res) => bankVouchersController.void(req as AuthenticatedRequest, res))

// POST /:id/print — generate PDF
// router.post('/:id/print', canView('bank_vouchers'),
//   (req, res) => bankVouchersController.print(req as AuthenticatedRequest, res))

// POST /opening-balance — set opening balance bulan pertama
// router.post('/opening-balance', canInsert('bank_vouchers'), validateSchema(bankVoucherOpeningBalanceSchema),
//   (req, res) => bankVouchersController.setOpeningBalance(req as AuthenticatedRequest, res))

export default router
