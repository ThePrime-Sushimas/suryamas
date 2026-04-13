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
  bankVoucherConfirmSchema,
  bankVoucherManualCreateSchema,
  bankVoucherVoidSchema,
  bankVoucherOpeningBalanceSchema,
  bankVoucherGetOpeningBalanceSchema,
  bankVoucherListSchema,
} from './bank-vouchers.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('bank_vouchers', 'Bank Vouchers').catch((error) => {
  console.error('Failed to register bank_vouchers module:', error.message)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Health
router.get('/health',
  (req, res) => bankVouchersController.health(req as AuthenticatedRequest, res))

// Dropdown: bank accounts
router.get('/bank-accounts',
  canView('bank_vouchers'),
  (req, res) => bankVouchersController.getBankAccounts(req as AuthenticatedRequest, res))

// Dropdown: payment methods (with COA + bank info)
router.get('/payment-methods',
  canView('bank_vouchers'),
  (req, res) => bankVouchersController.getPaymentMethods(req as AuthenticatedRequest, res))

// Preview (on-the-fly)
router.get('/preview',
  canView('bank_vouchers'),
  validateSchema(bankVoucherPreviewSchema),
  (req, res) => bankVouchersController.preview(req as AuthenticatedRequest, res))

// Summary (totals + running balance)
router.get('/summary',
  canView('bank_vouchers'),
  validateSchema(bankVoucherSummarySchema),
  (req, res) => bankVouchersController.summary(req as AuthenticatedRequest, res))

// List confirmed vouchers
router.get('/list',
  canView('bank_vouchers'),
  validateSchema(bankVoucherListSchema),
  (req, res) => bankVouchersController.list(req as AuthenticatedRequest, res))

// Opening balance — GET
router.get('/opening-balance',
  canView('bank_vouchers'),
  validateSchema(bankVoucherGetOpeningBalanceSchema),
  (req, res) => bankVouchersController.getOpeningBalance(req as AuthenticatedRequest, res))

// Opening balance — SET
router.post('/opening-balance',
  canInsert('bank_vouchers'),
  validateSchema(bankVoucherOpeningBalanceSchema),
  (req, res) => bankVouchersController.setOpeningBalance(req as AuthenticatedRequest, res))

// Confirm vouchers (from preview)
router.post('/confirm',
  canInsert('bank_vouchers'),
  validateSchema(bankVoucherConfirmSchema),
  (req, res) => bankVouchersController.confirm(req as AuthenticatedRequest, res))

// Manual create
router.post('/manual',
  canInsert('bank_vouchers'),
  validateSchema(bankVoucherManualCreateSchema),
  (req, res) => bankVouchersController.createManual(req as AuthenticatedRequest, res))

// Print voucher (HTML or JSON)
router.get('/:id/print',
  canView('bank_vouchers'),
  (req, res) => bankVouchersController.print(req as AuthenticatedRequest, res))

// Void voucher
router.post('/:id/void',
  canUpdate('bank_vouchers'),
  validateSchema(bankVoucherVoidSchema),
  (req, res) => bankVouchersController.voidVoucher(req as AuthenticatedRequest, res))

// Get voucher detail
router.get('/:id',
  canView('bank_vouchers'),
  (req, res) => bankVouchersController.getById(req as AuthenticatedRequest, res))

export default router
