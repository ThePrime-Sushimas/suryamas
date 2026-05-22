import type { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { storageService } from '../../services/storage.service'
import { apPaymentsService } from './ap-payments.service'
import { bulkCreateApPaymentSchema } from './ap-payments.schema'
import type { ApPaymentListFilter } from './ap-payments.types'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'

export class ApPaymentsController {
  // GET /ap-payments
  async list(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const q = req.query as Record<string, string>

      const filter: ApPaymentListFilter = {
        company_id: companyId,
        branch_id:      q.branch_id,
        supplier_id:    q.supplier_id,
        status:         q.status as ApPaymentListFilter['status'],
        payment_method: q.payment_method as ApPaymentListFilter['payment_method'],
        date_from:      q.date_from,
        date_to:        q.date_to,
        search:         q.search,
        page:           q.page  ? parseInt(q.page,  10) : 1,
        limit:          q.limit ? parseInt(q.limit, 10) : 20,
        bulk_only:      q.bulk_only === 'true',
      }

      const result = await apPaymentsService.list(filter)
      sendSuccess(res, result.data, 'AP payments retrieved', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit) || 1,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_ap_payments' })
    }
  }

  // GET /ap-payments/dashboard — branch_id optional (page filter); default = all branches user can access
  async dashboard(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const branchId = (req.query as { branch_id?: string }).branch_id

      const accessible = await getAccessibleBranchIds(userId)

      if (branchId && !accessible.includes(branchId)) {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const data = await apPaymentsService.getDashboard(
        companyId,
        branchId,
        branchId ? undefined : accessible,
      )
      sendSuccess(res, data, 'AP dashboard retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_ap_dashboard' })
    }
  }

  // GET /ap-payments/outstanding-invoices
  async outstandingInvoices(req: Request, res: Response): Promise<void> {
    try {
      const companyId  = req.context?.company_id ?? ''
      const { supplier_id, branch_id, overdue_only } = req.query as Record<string, string>

      const data = await apPaymentsService.getOutstandingInvoices(
        companyId,
        supplier_id,
        branch_id,
        overdue_only === 'true',
      )
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list outstanding invoices' })
    }
  }

  // GET /ap-payments/outstanding-invoices/paginated
  async outstandingInvoicesPaginated(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const query = (req as any).validated?.query ?? {}

      const branchIds = await getAccessibleBranchIds(userId)

      const result = await apPaymentsService.getOutstandingInvoicesPaginated(
        companyId,
        query,
        branchIds,
      )

      sendSuccess(res, result.data, 'Outstanding invoices retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list outstanding invoices paginated' })
    }
  }

  // PATCH /ap-payments/outstanding-invoices/:id/assign
  async assignBankAccount(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const invoiceId = req.params.id as string
      const { bank_account_id } = (req as any).validated?.body ?? req.body

      await apPaymentsService.assignBankAccountToInvoice(
        invoiceId,
        bank_account_id,
        companyId,
        userId,
      )

      sendSuccess(res, { invoice_id: invoiceId, bank_account_id }, 'Bank account assigned')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'assign bank account to invoice', id: req.params.id })
    }
  }

  // POST /ap-payments/outstanding-invoices/by-ids
  async outstandingInvoicesByIds(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const { invoice_ids } = (req as any).validated?.body ?? req.body

      const data = await apPaymentsService.getOutstandingInvoicesByIds(companyId, invoice_ids)
      sendSuccess(res, data, 'Outstanding invoices retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get outstanding invoices by ids' })
    }
  }

  // GET /ap-payments/:id
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.getById(id, companyId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments
  async create(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId  = req.context?.branch_id  ?? ''
      const userId    = req.user?.id             ?? ''
      const payment   = await apPaymentsService.create(req.body, companyId, branchId, userId)
      sendSuccess(res, payment, 'AP payment created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create ap payment' })
    }
  }

  // POST /ap-payments/bulk
  async createBulk(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId  = req.context?.branch_id  ?? ''
      const userId    = req.user?.id             ?? ''

      // Parse JSON payload from multipart field
      const payloadRaw = req.body?.payload
      if (!payloadRaw || typeof payloadRaw !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Missing payload field',
        })
        return
      }

      let parsedPayload: unknown
      try {
        parsedPayload = JSON.parse(payloadRaw)
      } catch {
        res.status(400).json({
          success: false,
          message: 'Invalid JSON in payload field',
        })
        return
      }

      // Validate with Zod schema (extract body shape from the route-level schema)
      const bodySchema = bulkCreateApPaymentSchema.shape.body
      const validation = bodySchema.safeParse(parsedPayload)
      if (!validation.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          validation_errors: validation.error.issues,
        })
        return
      }

      const body = validation.data

      // Note: Proof file upload is handled separately on the payment detail page.
      // The bulk create endpoint only creates DRAFT payments.
      const result = await apPaymentsService.createBulk(body, companyId, branchId, userId)
      sendSuccess(res, result, 'Bulk payments created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create bulk ap payments' })
    }
  }

  // PATCH /ap-payments/:id
  async update(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.update(id, req.body, companyId, userId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments/:id/submit
  async submit(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.submit(id, companyId, userId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments/:id/approve
  async approve(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.approve(id, companyId, userId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments/:id/reject
  async reject(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.reject(id, req.body, companyId, userId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments/:id/proof — multipart field `proof` → R2 buktisetoran
  async uploadProof(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string

      const file = req.file
      if (!file) {
        res.status(400).json({
          success: false,
          message:
            'File tidak diterima. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
        })
        return
      }

      const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic', 'heif']
      const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        res.status(400).json({
          success: false,
          message: `Tipe file .${ext} tidak didukung. Gunakan: ${ALLOWED_EXTENSIONS.join(', ')}`,
        })
        return
      }

      const fileName = `${id}-${Date.now()}.${ext}`
      const uploaded = await storageService.uploadApPaymentProof(
        file.buffer,
        fileName,
        file.mimetype,
        companyId,
        'buktisetoran',
      )

      const payment = await apPaymentsService.uploadProof(
        id,
        { proof_url: uploaded.path },
        companyId,
        userId,
      )
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload proof ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments/:id/pay
  async markPaid(req: Request, res: Response): Promise<void> {
    try {
      const companyId   = req.context?.company_id ?? ''
      const userId      = req.user?.id             ?? ''
      const id = req.params.id as string
      const paymentDate = req.body?.payment_date
      const payment     = await apPaymentsService.markPaid(id, paymentDate, companyId, userId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark paid ap payment', id: req.params.id })
    }
  }

  // POST /ap-payments/:id/reconcile
  async reconcile(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.reconcile(id, req.body, companyId, userId)
      sendSuccess(res, payment)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reconcile ap payment', id: req.params.id })
    }
  }

  // DELETE /ap-payments/:id
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      await apPaymentsService.delete(id, companyId, userId)
      sendSuccess(res, { message: 'AP payment deleted' })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete ap payment', id: req.params.id })
    }
  }
}

export const apPaymentsController = new ApPaymentsController()
