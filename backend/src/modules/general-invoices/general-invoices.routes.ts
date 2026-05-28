import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import {
  canView,
  canInsert,
  canUpdate,
  canDelete,
  canApprove,
} from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { documentUploadSingle } from '../../middleware/upload-document.middleware'
import { PermissionService } from '../../services/permission.service'
import {
  vendorsController,
  generalInvoicesController,
  generalInvoicePaymentsController,
  generalInvoiceTemplatesController,
} from './general-invoices.controller'
import {
  listVendorsSchema,
  vendorParamSchema,
  createVendorSchema,
  updateVendorSchema,
  listGeneralInvoicesSchema,
  generalInvoiceParamSchema,
  generalInvoiceDashboardSchema,
  createGeneralInvoiceSchema,
  updateGeneralInvoiceSchema,
  listGeneralPaymentsSchema,
  generalPaymentParamSchema,
  createGeneralInvoicePaymentSchema,
  rejectGeneralPaymentSchema,
  markPaidGeneralPaymentSchema,
  uploadProofGeneralPaymentSchema,
  generalTemplateParamSchema,
  createGeneralInvoiceTemplateSchema,
  generateFromTemplateSchema,
} from './general-invoices.schema'

// ─── Module registration ──────────────────────────────────────
PermissionService.registerModule('vendors', 'Vendors').catch(() => {})
PermissionService.registerModule('general_invoices', 'General Invoices').catch(() => {})
PermissionService.registerModule('general_invoice_payments', 'General Invoice Payments').catch(() => {})
PermissionService.registerModule('general_invoice_templates', 'General Invoice Templates').catch(() => {})

const router = Router()

// Apply auth + branch context to all routes
router.use(authenticate, resolveBranchContext)

// ============================================================
// VENDORS  →  /api/v1/vendors
// ============================================================
router.get(    '/vendors',     canView('vendors'),   validateSchema(listVendorsSchema),   (req, res) => vendorsController.list(req, res))
router.get(    '/vendors/:id', canView('vendors'),   validateSchema(vendorParamSchema),   (req, res) => vendorsController.getById(req, res))
router.post(   '/vendors',     requireWriteAccess, canInsert('vendors'), validateSchema(createVendorSchema),  (req, res) => vendorsController.create(req, res))
router.put(    '/vendors/:id', requireWriteAccess, canUpdate('vendors'), validateSchema(updateVendorSchema),  (req, res) => vendorsController.update(req, res))
router.delete( '/vendors/:id', requireWriteAccess, canDelete('vendors'), validateSchema(vendorParamSchema),   (req, res) => vendorsController.delete(req, res))

// ============================================================
// GENERAL INVOICES  →  /api/v1/general-invoices
// ============================================================

// NOTE: /dashboard and /generate must be registered BEFORE /:id to avoid route conflict
router.get(    '/general-invoices/dashboard', canView('general_invoices'),   validateSchema(generalInvoiceDashboardSchema), (req, res) => generalInvoicesController.dashboard(req, res))
router.get(    '/general-invoices',           canView('general_invoices'),   validateSchema(listGeneralInvoicesSchema),     (req, res) => generalInvoicesController.list(req, res))
router.get(    '/general-invoices/:id',       canView('general_invoices'),   validateSchema(generalInvoiceParamSchema),     (req, res) => generalInvoicesController.getById(req, res))
router.post(   '/general-invoices',           requireWriteAccess, canInsert('general_invoices'), validateSchema(createGeneralInvoiceSchema),   (req, res) => generalInvoicesController.create(req, res))
router.put(    '/general-invoices/:id',       requireWriteAccess, canUpdate('general_invoices'), validateSchema(updateGeneralInvoiceSchema),   (req, res) => generalInvoicesController.update(req, res))
router.post(   '/general-invoices/:id/post',   requireWriteAccess, canUpdate('general_invoices'), validateSchema(generalInvoiceParamSchema), (req, res) => generalInvoicesController.post(req, res))
router.post(   '/general-invoices/:id/cancel', requireWriteAccess, canUpdate('general_invoices'), validateSchema(generalInvoiceParamSchema),   (req, res) => generalInvoicesController.cancel(req, res))
router.post(
  '/general-invoices/:id/attachment',
  requireWriteAccess,
  canUpdate('general_invoices'),
  documentUploadSingle('file'),
  validateSchema(generalInvoiceParamSchema),
  (req, res) => generalInvoicesController.uploadAttachment(req, res),
)
router.delete( '/general-invoices/:id',        requireWriteAccess, canDelete('general_invoices'), validateSchema(generalInvoiceParamSchema),   (req, res) => generalInvoicesController.delete(req, res))

// ============================================================
// GENERAL INVOICE PAYMENTS  →  /api/v1/general-invoice-payments
// ============================================================
router.get(    '/general-invoice-payments',                  canView('general_invoice_payments'),   validateSchema(listGeneralPaymentsSchema),            (req, res) => generalInvoicePaymentsController.list(req, res))
router.get(    '/general-invoice-payments/:id',              canView('general_invoice_payments'),   validateSchema(generalPaymentParamSchema),            (req, res) => generalInvoicePaymentsController.getById(req, res))
router.post(   '/general-invoice-payments',                  requireWriteAccess, canInsert('general_invoice_payments'), validateSchema(createGeneralInvoicePaymentSchema),    (req, res) => generalInvoicePaymentsController.create(req, res))
router.post(   '/general-invoice-payments/:id/approve',      requireWriteAccess, canApprove('general_invoice_payments'), validateSchema(generalPaymentParamSchema),           (req, res) => generalInvoicePaymentsController.approve(req, res))
router.post(   '/general-invoice-payments/:id/reject',       requireWriteAccess, canApprove('general_invoice_payments'), validateSchema(rejectGeneralPaymentSchema),          (req, res) => generalInvoicePaymentsController.reject(req, res))
router.post(
  '/general-invoice-payments/:id/upload-proof',
  requireWriteAccess,
  canUpdate('general_invoice_payments'),
  documentUploadSingle('file'),
  validateSchema(generalPaymentParamSchema),
  (req, res) => generalInvoicePaymentsController.uploadProof(req, res),
)
router.post(   '/general-invoice-payments/:id/mark-paid',    requireWriteAccess, canUpdate('general_invoice_payments'), validateSchema(markPaidGeneralPaymentSchema), (req, res) => generalInvoicePaymentsController.markPaid(req, res))
router.delete( '/general-invoice-payments/:id/journal',      requireWriteAccess, canUpdate('general_invoice_payments'), validateSchema(generalPaymentParamSchema),            (req, res) => generalInvoicePaymentsController.deleteJournal(req, res))
router.delete( '/general-invoice-payments/:id',              requireWriteAccess, canDelete('general_invoice_payments'), validateSchema(generalPaymentParamSchema),            (req, res) => generalInvoicePaymentsController.delete(req, res))

// ============================================================
// GENERAL INVOICE TEMPLATES  →  /api/v1/general-invoice-templates
// ============================================================

// NOTE: /generate must be registered BEFORE /:id
router.get(    '/general-invoice-templates',          canView('general_invoice_templates'),   (req, res) => generalInvoiceTemplatesController.list(req, res))
router.get(    '/general-invoice-templates/:id',      canView('general_invoice_templates'),   validateSchema(generalTemplateParamSchema),          (req, res) => generalInvoiceTemplatesController.getById(req, res))
router.post(   '/general-invoice-templates',          requireWriteAccess, canInsert('general_invoice_templates'), validateSchema(createGeneralInvoiceTemplateSchema),  (req, res) => generalInvoiceTemplatesController.create(req, res))
router.post(   '/general-invoice-templates/generate', requireWriteAccess, canInsert('general_invoice_templates'), validateSchema(generateFromTemplateSchema),          (req, res) => generalInvoiceTemplatesController.generate(req, res))
router.delete( '/general-invoice-templates/:id',      requireWriteAccess, canDelete('general_invoice_templates'), validateSchema(generalTemplateParamSchema),          (req, res) => generalInvoiceTemplatesController.delete(req, res))

export default router
