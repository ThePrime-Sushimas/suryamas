import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import {
  canView,
  canInsert,
  canUpdate,
  canApprove,
  canDelete,
} from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { documentUpload, documentUploadSingle } from '../../middleware/upload-document.middleware'
import { PermissionService } from '../../services/permission.service'
import { apPaymentsController } from './ap-payments.controller'
import {
  listApPaymentsSchema,
  outstandingInvoicesSchema,
  outstandingInvoicesQuerySchema,
  outstandingInvoicesByIdsSchema,
  assignBankAccountSchema,
  apDashboardSchema,
  apPaymentParamSchema,
  createApPaymentSchema,
  updateApPaymentSchema,
  rejectApPaymentSchema,
  uploadProofSchema,
  reconcileApPaymentSchema,
} from './ap-payments.schema'

const MODULE = 'ap_payments'

PermissionService.registerModule(MODULE, 'AP Payments').catch(() => {})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/dashboard',
  canView(MODULE),
  validateSchema(apDashboardSchema),
  (req, res) => apPaymentsController.dashboard(req, res),
)

router.get(
  '/outstanding-invoices',
  canView(MODULE),
  validateSchema(outstandingInvoicesSchema),
  (req, res) => apPaymentsController.outstandingInvoices(req, res),
)

router.get(
  '/outstanding-invoices/paginated',
  canView(MODULE),
  validateSchema(outstandingInvoicesQuerySchema),
  (req, res) => apPaymentsController.outstandingInvoicesPaginated(req, res),
)

router.patch(
  '/outstanding-invoices/:id/assign',
  canInsert(MODULE),
  requireWriteAccess,
  validateSchema(assignBankAccountSchema),
  (req, res) => apPaymentsController.assignBankAccount(req, res),
)

router.post(
  '/outstanding-invoices/by-ids',
  canView(MODULE),
  validateSchema(outstandingInvoicesByIdsSchema),
  (req, res) => apPaymentsController.outstandingInvoicesByIds(req, res),
)

router.get(
  '/',
  canView(MODULE),
  validateSchema(listApPaymentsSchema),
  (req, res) => apPaymentsController.list(req, res),
)

router.post(
  '/',
  canInsert(MODULE),
  requireWriteAccess,
  validateSchema(createApPaymentSchema),
  (req, res) => apPaymentsController.create(req, res),
)

router.post(
  '/bulk',
  canInsert(MODULE),
  requireWriteAccess,
  documentUpload.any(),
  (req, res) => apPaymentsController.createBulk(req, res),
)

router.get(
  '/:id',
  canView(MODULE),
  validateSchema(apPaymentParamSchema),
  (req, res) => apPaymentsController.getById(req, res),
)

router.patch(
  '/:id',
  canUpdate(MODULE),
  requireWriteAccess,
  validateSchema(updateApPaymentSchema),
  (req, res) => apPaymentsController.update(req, res),
)

router.delete(
  '/:id',
  canDelete(MODULE),
  requireWriteAccess,
  validateSchema(apPaymentParamSchema),
  (req, res) => apPaymentsController.delete(req, res),
)

router.post(
  '/:id/submit',
  canUpdate(MODULE),
  requireWriteAccess,
  validateSchema(apPaymentParamSchema),
  (req, res) => apPaymentsController.submit(req, res),
)

router.post(
  '/:id/approve',
  canApprove(MODULE),
  validateSchema(apPaymentParamSchema),
  (req, res) => apPaymentsController.approve(req, res),
)

router.post(
  '/:id/reject',
  canApprove(MODULE),
  validateSchema(rejectApPaymentSchema),
  (req, res) => apPaymentsController.reject(req, res),
)

router.post(
  '/:id/proof',
  canUpdate(MODULE),
  requireWriteAccess,
  validateSchema(uploadProofSchema),
  documentUploadSingle('proof'),
  (req, res) => apPaymentsController.uploadProof(req, res),
)

router.post(
  '/:id/pay',
  canUpdate(MODULE),
  requireWriteAccess,
  validateSchema(apPaymentParamSchema),
  (req, res) => apPaymentsController.markPaid(req, res),
)

router.post(
  '/:id/reconcile',
  canUpdate(MODULE),
  requireWriteAccess,
  validateSchema(reconcileApPaymentSchema),
  (req, res) => apPaymentsController.reconcile(req, res),
)

router.get(
  '/:id/reconcile-candidates',
  canView(MODULE),
  validateSchema(apPaymentParamSchema),
  (req, res) => apPaymentsController.getReconcileCandidates(req, res),
)

export default router
