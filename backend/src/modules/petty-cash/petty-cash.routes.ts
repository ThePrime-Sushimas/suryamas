import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canInsert, canUpdate, canDelete, canApprove, canRelease } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { documentUploadSingle } from '../../middleware/upload-document.middleware'
import { PermissionService } from '../../services/permission.service'
import { pettyCashController } from './petty-cash.controller'
import {
  listRequestsSchema,
  getRequestSchema,
  createRequestSchema,
  approveRequestSchema,
  rejectRequestSchema,
  listExpensesSchema,
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
  createSettlementSchema,
  voidSettlementSchema,
  expenseReportSchema,
} from './petty-cash.schema'

const MODULE = 'petty_cash'

PermissionService.registerModule(MODULE, 'Petty Cash').catch(() => {})

const router = Router()

router.use(authenticate, resolveBranchContext)

// ─── Requests ─────────────────────────────────────────────────────────────────

router.get(
  '/',
  canView(MODULE),
  validateSchema(listRequestsSchema),
  (req, res) => pettyCashController.listRequests(req, res),
)

router.get(
  '/report/expenses',
  canView(MODULE),
  validateSchema(expenseReportSchema),
  (req, res) => pettyCashController.getExpenseReport(req, res),
)

router.get(
  '/:id',
  canView(MODULE),
  validateSchema(getRequestSchema),
  (req, res) => pettyCashController.getRequest(req, res),
)

router.post(
  '/',
  canInsert(MODULE),
  requireWriteAccess,
  validateSchema(createRequestSchema),
  (req, res) => pettyCashController.createRequest(req, res),
)

router.post(
  '/:id/approve',
  canApprove(MODULE),
  requireWriteAccess,
  validateSchema(approveRequestSchema),
  (req, res) => pettyCashController.approveRequest(req, res),
)

router.post(
  '/:id/reject',
  canApprove(MODULE),
  validateSchema(rejectRequestSchema),
  (req, res) => pettyCashController.rejectRequest(req, res),
)

// ─── Expenses ─────────────────────────────────────────────────────────────────

router.get(
  '/:id/expenses',
  canView(MODULE),
  validateSchema(listExpensesSchema),
  (req, res) => pettyCashController.listExpenses(req, res),
)

router.post(
  '/:id/expenses',
  canInsert(MODULE),
  requireWriteAccess,
  validateSchema(createExpenseSchema),
  (req, res) => pettyCashController.createExpense(req, res),
)

router.put(
  '/expenses/:id',
  canUpdate(MODULE),
  requireWriteAccess,
  validateSchema(updateExpenseSchema),
  (req, res) => pettyCashController.updateExpense(req, res),
)

router.delete(
  '/expenses/:id',
  canDelete(MODULE),
  requireWriteAccess,
  validateSchema(deleteExpenseSchema),
  (req, res) => pettyCashController.deleteExpense(req, res),
)

router.post(
  '/expenses/:id/upload-receipt',
  canUpdate(MODULE),
  requireWriteAccess,
  documentUploadSingle('receipt'),
  (req, res) => pettyCashController.uploadReceipt(req, res),
)

// ─── Settlement ───────────────────────────────────────────────────────────────

router.post(
  '/:id/settlement',
  canInsert(MODULE),
  requireWriteAccess,
  validateSchema(createSettlementSchema),
  (req, res) => pettyCashController.createSettlement(req, res),
)

router.post(
  '/settlements/:id/void',
  canRelease(MODULE),
  requireWriteAccess,
  validateSchema(voidSettlementSchema),
  (req, res) => pettyCashController.voidSettlement(req, res),
)

export default router
