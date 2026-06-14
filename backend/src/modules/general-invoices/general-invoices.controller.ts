import type { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, getAccessibleCompanyIds, resolveContextCompanyId } from '../../utils/branch-access.util'

async function giScope(req: Request) {
  const userId = req.user?.id ?? ''
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return {
    userId,
    branchIds,
    companyIds,
    contextBranchId: req.context?.branch_id ?? '',
    contextCompanyId: resolveContextCompanyId(req.context?.company_id ?? '', companyIds),
  }
}

function resolveBranchFilter(accessible: string[], branchId?: string): string[] {
  if (!branchId) return accessible
  if (!accessible.includes(branchId)) {
    throw Object.assign(new Error('No access to this branch'), { statusCode: 403 })
  }
  return [branchId]
}
import {
  vendorService,
  generalInvoiceService,
  generalInvoicePaymentService,
  generalInvoiceTemplateService,
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
      const { companyIds } = await giScope(req)
      const q = req.query as Record<string, string>

      const filter: VendorListFilter = {
        company_ids: companyIds,
        search:      q.search,
        vendor_type: q.vendor_type as VendorListFilter['vendor_type'],
        is_active:   q.is_active === 'true' ? true : q.is_active === 'false' ? false : undefined,
        sort_by:     q.sort_by as VendorListFilter['sort_by'],
        sort_order:  q.sort_order as VendorListFilter['sort_order'],
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
      const { companyIds } = await giScope(req)
      const vendor = await vendorService.getById(req.params.id as string, companyIds)
      sendSuccess(res, vendor)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_vendor', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyIds, contextCompanyId, userId } = await giScope(req)
      const vendor    = await vendorService.create(req.body, companyIds, contextCompanyId, userId)
      sendSuccess(res, vendor, 'Vendor berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_vendor' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyIds, userId } = await giScope(req)
      const vendor    = await vendorService.update(req.params.id as string, req.body, companyIds, userId)
      sendSuccess(res, vendor)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_vendor', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyIds, userId } = await giScope(req)
      await vendorService.delete(req.params.id as string, companyIds, userId)
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
      const { branchIds } = await giScope(req)
      const branchId  = req.query.branch_id as string | undefined

      let scopeBranchIds: string[]
      try {
        scopeBranchIds = resolveBranchFilter(branchIds, branchId)
      } catch {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.release

      const data = await generalInvoiceService.getDashboard(
        scopeBranchIds,
        canViewConfidential,
      )
      sendSuccess(res, data, 'General AP dashboard retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_invoice_dashboard' })
    }
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds } = await giScope(req)
      const q = req.query as Record<string, string>

      let scopeBranchIds: string[]
      try {
        scopeBranchIds = resolveBranchFilter(branchIds, q.branch_id)
      } catch {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.release

      const filter: GeneralInvoiceListFilter = {
        branch_ids:          scopeBranchIds,
        branch_id:           q.branch_id,
        status:              q.status as GeneralInvoiceListFilter['status'],
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
      const { branchIds } = await giScope(req)
      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.release

      const invoice = await generalInvoiceService.getById(req.params.id as string, branchIds)

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
      const { branchIds, contextBranchId, userId } = await giScope(req)
      const invoice   = await generalInvoiceService.create(req.body, branchIds, contextBranchId, userId)
      sendSuccess(res, invoice, 'General invoice berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_general_invoice' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const invoice   = await generalInvoiceService.update(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, invoice)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_general_invoice', id: req.params.id })
    }
  }

  post = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const invoice = await generalInvoiceService.post(req.params.id as string, branchIds, userId)
      sendSuccess(res, invoice, 'Invoice berhasil diposting')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_general_invoice', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const invoice = await generalInvoiceService.cancel(req.params.id as string, branchIds, userId)
      sendSuccess(res, invoice, 'Invoice berhasil dibatalkan')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_general_invoice', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      await generalInvoiceService.delete(req.params.id as string, branchIds, userId)
      sendSuccess(res, null, 'Invoice berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_invoice', id: req.params.id })
    }
  }

  forceDelete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      await generalInvoiceService.forceDelete(req.params.id as string, branchIds, userId)
      sendSuccess(res, null, 'Invoice berhasil dihapus permanen (hard delete)')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'force_delete_general_invoice', id: req.params.id })
    }
  }

  uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
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
        branchIds,
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
      const { branchIds } = await giScope(req)
      const q = req.query as Record<string, string>

      let scopeBranchIds: string[]
      try {
        scopeBranchIds = resolveBranchFilter(branchIds, q.branch_id)
      } catch {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.release

      const filter: GeneralPaymentListFilter = {
        branch_ids:           scopeBranchIds,
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
        totalPages: result.limit === -1 ? 1 : (Math.ceil(result.total / result.limit) || 1),
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_general_payments' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds } = await giScope(req)
      const payment   = await generalInvoicePaymentService.getById(req.params.id as string, branchIds)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_payment', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, contextBranchId, userId } = await giScope(req)
      const payment   = await generalInvoicePaymentService.create(req.body, branchIds, contextBranchId, userId)
      sendSuccess(res, payment, 'General payment berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_general_payment' })
    }
  }

  approve = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const payment   = await generalInvoicePaymentService.approve(req.params.id as string, branchIds, userId)
      sendSuccess(res, payment, 'Payment berhasil disetujui')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_general_payment', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const { reason } = req.body
      const payment   = await generalInvoicePaymentService.reject(req.params.id as string, reason, branchIds, userId)
      sendSuccess(res, payment, 'Payment berhasil ditolak')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_general_payment', id: req.params.id })
    }
  }

  uploadProof = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const file = req.file
      const proofUrlFromBody = typeof req.body?.proof_url === 'string' ? req.body.proof_url : undefined

      if (!file && !proofUrlFromBody?.trim()) {
        res.status(400).json({ success: false, message: 'File bukti pembayaran wajib diupload' })
        return
      }

      const payment = file
        ? await generalInvoicePaymentService.uploadProofFile(
            req.params.id as string,
            branchIds,
            userId,
            file,
          )
        : await generalInvoicePaymentService.uploadProof(
            req.params.id as string,
            proofUrlFromBody!.trim(),
            branchIds,
            userId,
          )

      sendSuccess(res, payment, 'Bukti pembayaran berhasil diupload')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_proof_general_payment', id: req.params.id })
    }
  }

  markPaid = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const { payment_date } = req.body
      const payment      = await generalInvoicePaymentService.markPaid(req.params.id as string, payment_date, branchIds, userId)
      sendSuccess(res, payment, 'Payment berhasil ditandai lunas')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark_paid_general_payment', id: req.params.id })
    }
  }

  deleteJournal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const payment = await generalInvoicePaymentService.deleteJournal(req.params.id as string, branchIds, userId)
      sendSuccess(res, payment, 'Journal berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_payment_journal', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      await generalInvoicePaymentService.delete(req.params.id as string, branchIds, userId)
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
      const { companyIds } = await giScope(req)
      const templates = await generalInvoiceTemplateService.list(companyIds)
      sendSuccess(res, templates, 'Templates retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_general_templates' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyIds } = await giScope(req)
      const template  = await generalInvoiceTemplateService.getById(req.params.id as string, companyIds)
      sendSuccess(res, template)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_general_template', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyIds, branchIds, contextBranchId, userId } = await giScope(req)
      const template  = await generalInvoiceTemplateService.create(req.body, companyIds, branchIds, contextBranchId, userId)
      sendSuccess(res, template, 'Template berhasil dibuat', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_general_template' })
    }
  }

  generate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyIds, branchIds, contextBranchId, userId } = await giScope(req)
      const invoice   = await generalInvoiceTemplateService.generateFromTemplate(
        req.body,
        companyIds,
        branchIds,
        contextBranchId,
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
      const { companyIds, userId } = await giScope(req)
      await generalInvoiceTemplateService.delete(req.params.id as string, companyIds, userId)
      sendSuccess(res, null, 'Template berhasil dihapus')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_general_template', id: req.params.id })
    }
  }

  // ── Amortization endpoints ──────────────────────────────────
  listAmortizations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds } = await giScope(req)
      const q = req.query as Record<string, string>
      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.release

      const data = await generalInvoiceTemplateService.listAmortizations(branchIds, {
        branch_id: q.branch_id,
        status: q.status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | undefined,
        overdue: q.overdue === 'true' || q.overdue === '1',
        include_confidential: canViewConfidential,
        page: q.page ? parseInt(q.page, 10) : 1,
        limit: q.limit ? parseInt(q.limit, 10) : 20,
      })
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_amortizations' })
    }
  }

  executeAmortization = async (req: Request, res: Response): Promise<void> => {
    try {
      const { branchIds, userId } = await giScope(req)
      const canViewConfidential = !!(req.permissions?.['general_invoices'] as any)?.release
      const { period_number, period_date } = req.body as { period_number: number; period_date?: string }
      const result = await generalInvoiceTemplateService.executeAmortizationEntry(
        req.params.id as string,
        period_number,
        period_date,
        branchIds,
        userId,
        canViewConfidential,
      )
      sendSuccess(res, result, 'Amortisasi berhasil dieksekusi')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'execute_amortization', id: req.params.id })
    }
  }
}

// Singleton exports
export const vendorsController                 = new VendorsController()
export const generalInvoicesController         = new GeneralInvoicesController()
export const generalInvoicePaymentsController  = new GeneralInvoicePaymentsController()
export const generalInvoiceTemplatesController = new GeneralInvoiceTemplatesController()
