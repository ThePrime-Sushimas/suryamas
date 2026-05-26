import type { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import {
  vendorService,
  generalInvoiceService,
  generalInvoicePaymentService,
  generalInvoiceTemplateService,
  expenseCoaDefaultService,
} from './general-invoices.service'
import type {
  VendorListFilter,
  GeneralInvoiceListFilter,
  GeneralPaymentListFilter,
} from './general-invoices.types'

// ============================================================
// VENDOR CONTROLLER
// ============================================================
export class VendorsController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const q = req.query as Record<string, string>

      const filter: VendorListFilter = {
        company_id:  companyId,
        search:      q.search,
        vendor_type: q.vendor_type as VendorListFilter['vendor_type'],
        is_active:   q.is_active === 'true' ? true : q.is_active === 'false' ? false : undefined,
        page:        q.page  ? parseInt(q.page,  10) : 1,
        limit:       q.limit ? parseInt(q.limit, 10) : 50,
      }

      const result = await vendorService.list(filter)
      sendSuccess(res, result.data, 'Vendors retrieved', 200, {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_vendors' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const vendor = await vendorService.getById(req.params.id as string, companyId)
      sendSuccess(res, vendor)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_vendor', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const vendor    = await vendorService.create(req.body, companyId, userId)
      sendSuccess(res, vendor, 'Vendor berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_vendor' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const vendor    = await vendorService.update(req.params.id as string, req.body, companyId, userId)
      sendSuccess(res, vendor)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_vendor', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      await vendorService.delete(req.params.id as string, companyId, userId)
      sendSuccess(res, null, 'Vendor berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_vendor', id: req.params.id })
    }
  }
}

// ============================================================
// GENERAL INVOICE CONTROLLER
// ============================================================
export class GeneralInvoicesController {
  dashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const branchId  = req.query.branch_id as string | undefined

      const accessible = await getAccessibleBranchIds(userId)
      if (branchId && !accessible.includes(branchId)) {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.view_confidential

      const data = await generalInvoiceService.getDashboard(
        companyId,
        branchId ? [branchId] : accessible,
        canViewConfidential,
      )
      sendSuccess(res, data, 'General AP dashboard retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_invoice_dashboard' })
    }
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const q = req.query as Record<string, string>

      const accessible = await getAccessibleBranchIds(userId)
      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.view_confidential

      const filter: GeneralInvoiceListFilter = {
        company_id:          companyId,
        branch_ids:          accessible,
        branch_id:           q.branch_id,
        status:              q.status as GeneralInvoiceListFilter['status'],
        expense_type:        q.expense_type as GeneralInvoiceListFilter['expense_type'],
        vendor_id:           q.vendor_id,
        due_date_from:       q.due_date_from,
        due_date_to:         q.due_date_to,
        invoice_date_from:   q.invoice_date_from,
        invoice_date_to:     q.invoice_date_to,
        search:              q.search,
        overdue:             q.overdue === 'true' || q.overdue === '1',
        include_confidential: canViewConfidential,
        page:                q.page  ? parseInt(q.page,  10) : 1,
        limit:               q.limit ? parseInt(q.limit, 10) : 20,
      }

      const result = await generalInvoiceService.list(filter)
      sendSuccess(res, result.data, 'General invoices retrieved', 200, {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_general_invoices' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.view_confidential

      const invoice = await generalInvoiceService.getById(req.params.id as string, companyId)

      if (invoice.is_confidential && !canViewConfidential) {
        res.status(403).json({ success: false, message: 'Akses tidak diizinkan untuk tagihan ini' })
        return
      }

      sendSuccess(res, invoice)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_invoice', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId  = req.context?.branch_id  ?? ''
      const userId    = req.user?.id             ?? ''
      const invoice   = await generalInvoiceService.create(req.body, companyId, branchId, userId)
      sendSuccess(res, invoice, 'General invoice berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_general_invoice' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const invoice   = await generalInvoiceService.update(req.params.id as string, req.body, companyId, userId)
      sendSuccess(res, invoice)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_general_invoice', id: req.params.id })
    }
  }

  post = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId  = req.context?.company_id  ?? ''
      const userId     = req.user?.id              ?? ''
      const employeeId = req.context?.employee_id
      const invoice    = await generalInvoiceService.post(req.params.id as string, companyId, userId, employeeId)
      sendSuccess(res, invoice, 'Invoice berhasil diposting')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_general_invoice', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId  = req.context?.company_id  ?? ''
      const userId     = req.user?.id              ?? ''
      const employeeId = req.context?.employee_id
      const invoice    = await generalInvoiceService.cancel(req.params.id as string, companyId, userId, employeeId)
      sendSuccess(res, invoice, 'Invoice berhasil dibatalkan')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_general_invoice', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      await generalInvoiceService.delete(req.params.id as string, companyId, userId)
      sendSuccess(res, null, 'Invoice berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_invoice', id: req.params.id })
    }
  }

  uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const file = req.file
      if (!file) {
        res.status(400).json({
          success: false,
          message: 'File tidak diterima. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
        })
        return
      }

      const invoice = await generalInvoiceService.uploadAttachment(
        req.params.id as string,
        companyId,
        userId,
        file,
      )
      sendSuccess(res, invoice, 'Lampiran tagihan berhasil diupload')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_general_invoice_attachment', id: req.params.id })
    }
  }
}

// ============================================================
// GENERAL INVOICE PAYMENT CONTROLLER
// ============================================================
export class GeneralInvoicePaymentsController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const q = req.query as Record<string, string>

      const accessible = await getAccessibleBranchIds(userId)
      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.view_confidential

      const filter: GeneralPaymentListFilter = {
        company_id:           companyId,
        branch_ids:           accessible,
        branch_id:            q.branch_id,
        status:               q.status as GeneralPaymentListFilter['status'],
        vendor_id:            q.vendor_id,
        payment_date_from:    q.payment_date_from,
        payment_date_to:      q.payment_date_to,
        search:               q.search,
        include_confidential: canViewConfidential,
        page:                 q.page  ? parseInt(q.page,  10) : 1,
        limit:                q.limit ? parseInt(q.limit, 10) : 20,
      }

      const result = await generalInvoicePaymentService.list(filter)
      sendSuccess(res, result.data, 'General payments retrieved', 200, {
        page:       result.page,
        limit:      result.limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_general_payments' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const payment   = await generalInvoicePaymentService.getById(req.params.id as string, companyId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_payment', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId  = req.context?.branch_id  ?? ''
      const userId    = req.user?.id             ?? ''
      const payment   = await generalInvoicePaymentService.create(req.body, companyId, branchId, userId)
      sendSuccess(res, payment, 'General payment berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_general_payment' })
    }
  }

  approve = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const payment   = await generalInvoicePaymentService.approve(req.params.id as string, companyId, userId)
      sendSuccess(res, payment, 'Payment berhasil disetujui')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_general_payment', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const { reason } = req.body
      const payment   = await generalInvoicePaymentService.reject(req.params.id as string, reason, companyId, userId)
      sendSuccess(res, payment, 'Payment berhasil ditolak')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_general_payment', id: req.params.id })
    }
  }

  uploadProof = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const file = req.file
      const proofUrlFromBody = typeof req.body?.proof_url === 'string' ? req.body.proof_url : undefined

      if (!file && !proofUrlFromBody?.trim()) {
        res.status(400).json({ success: false, message: 'File bukti pembayaran wajib diupload' })
        return
      }

      const payment = file
        ? await generalInvoicePaymentService.uploadProofFile(
            req.params.id as string,
            companyId,
            userId,
            file,
          )
        : await generalInvoicePaymentService.uploadProof(
            req.params.id as string,
            proofUrlFromBody!.trim(),
            companyId,
            userId,
          )

      sendSuccess(res, payment, 'Bukti pembayaran berhasil diupload')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_proof_general_payment', id: req.params.id })
    }
  }

  markPaid = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId    = req.context?.company_id ?? ''
      const userId       = req.user?.id             ?? ''
      const employeeId   = req.context?.employee_id
      const { payment_date } = req.body
      const payment      = await generalInvoicePaymentService.markPaid(req.params.id as string, payment_date, companyId, userId, employeeId)
      sendSuccess(res, payment, 'Payment berhasil ditandai lunas')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark_paid_general_payment', id: req.params.id })
    }
  }

  deleteJournal = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId     = req.user?.id              ?? ''
      const employeeId = req.context?.employee_id
      const payment    = await generalInvoicePaymentService.deleteJournal(req.params.id as string, companyId, userId, employeeId)
      sendSuccess(res, payment, 'Journal berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_payment_journal', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      await generalInvoicePaymentService.delete(req.params.id as string, companyId, userId)
      sendSuccess(res, null, 'Payment berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_payment', id: req.params.id })
    }
  }
}

// ============================================================
// TEMPLATE CONTROLLER
// ============================================================
export class GeneralInvoiceTemplatesController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const templates = await generalInvoiceTemplateService.list(companyId)
      sendSuccess(res, templates, 'Templates retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_general_templates' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const template  = await generalInvoiceTemplateService.getById(req.params.id as string, companyId)
      sendSuccess(res, template)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_template', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId  = req.context?.branch_id  ?? ''
      const userId    = req.user?.id             ?? ''
      const template  = await generalInvoiceTemplateService.create(req.body, companyId, branchId, userId)
      sendSuccess(res, template, 'Template berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_general_template' })
    }
  }

  generate = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId  = req.context?.branch_id  ?? ''
      const userId    = req.user?.id             ?? ''
      const invoice   = await generalInvoiceTemplateService.generateFromTemplate(
        req.body,
        companyId,
        branchId,
        userId,
        generalInvoiceService,
      )
      sendSuccess(res, invoice, 'Invoice berhasil digenerate dari template', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'generate_from_template' })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      await generalInvoiceTemplateService.delete(req.params.id as string, companyId, userId)
      sendSuccess(res, null, 'Template berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_template', id: req.params.id })
    }
  }
}

// Singleton exports
export const vendorsController                 = new VendorsController()
export const generalInvoicesController         = new GeneralInvoicesController()
export const generalInvoicePaymentsController  = new GeneralInvoicePaymentsController()
export const generalInvoiceTemplatesController = new GeneralInvoiceTemplatesController()

// ============================================================
// EXPENSE COA DEFAULTS CONTROLLER
// ============================================================
export class ExpenseCoaDefaultsController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const data = await expenseCoaDefaultService.list(companyId)
      sendSuccess(res, data, 'Expense COA defaults retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_expense_coa_defaults' })
    }
  }

  upsert = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const data = await expenseCoaDefaultService.upsert(req.body, companyId, userId)
      sendSuccess(res, data, 'Default COA per kategori disimpan')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upsert_expense_coa_defaults' })
    }
  }

  suggest = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = req.context?.company_id ?? ''
      const expenseType = req.query.expense_type as string
      if (!expenseType) {
        res.status(400).json({ success: false, message: 'expense_type query required' })
        return
      }
      const accountId = await expenseCoaDefaultService.getAccountIdForExpenseType(
        companyId,
        expenseType as import('./general-invoices.types').ExpenseType,
      )
      sendSuccess(res, { account_id: accountId })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'suggest_expense_coa' })
    }
  }
}

export const expenseCoaDefaultsController = new ExpenseCoaDefaultsController()
