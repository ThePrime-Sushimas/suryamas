import { Router } from 'express'
import { bankVouchersController } from './bank-vouchers.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { bankVoucherPreviewSchema, bankVoucherSummarySchema } from './bank-vouchers.schema'
import type { AuthRequest } from '../../types/common.types'

PermissionService.registerModule('bank_vouchers', 'Bank Vouchers').catch((error) => {
  console.error('Failed to register bank_vouchers module:', error.message)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// ============================================
// DROPDOWN / FILTER OPTIONS
// ============================================

// GET /api/v1/bank-vouchers/bank-accounts
// Ambil list bank account untuk dropdown filter
router.get(
  '/bank-accounts',
  canView('bank_vouchers'),
  (req, res) => bankVouchersController.getBankAccounts(req as AuthRequest, res)
)

// ============================================
// PREVIEW (main endpoint)
// ============================================

// GET /api/v1/bank-vouchers/preview?period_month=2&period_year=2026&branch_id=...
// Preview buku mutasi bank — on-the-fly dari aggregated_transactions
router.get(
  '/preview',
  canView('bank_vouchers'),
  validateSchema(bankVoucherPreviewSchema),
  (req, res) => bankVouchersController.preview(req as AuthRequest, res)
)

// ============================================
// SUMMARY
// ============================================

// GET /api/v1/bank-vouchers/summary?period_month=2&period_year=2026
// Total BM, BK, saldo berjalan per periode
router.get(
  '/summary',
  canView('bank_vouchers'),
  validateSchema(bankVoucherSummarySchema),
  (req, res) => bankVouchersController.summary(req as AuthRequest, res)
)

// ============================================
// PHASE 2 PLACEHOLDERS (uncomment setelah BK selesai)
// ============================================

// POST /api/v1/bank-vouchers/confirm
// Freeze voucher ke bank_vouchers table
// router.post('/confirm', canInsert('bank_vouchers'), ...)

// GET /api/v1/bank-vouchers/:id
// Get confirmed voucher by ID
// router.get('/:id', canView('bank_vouchers'), ...)

export default router
