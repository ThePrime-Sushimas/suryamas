import type { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { apPaymentsService } from './ap-payments.service'
import type { ApPaymentListFilter } from './ap-payments.types'

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

  // GET /ap-payments/dashboard
  async dashboard(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const branchId = (req.query as { branch_id?: string }).branch_id
      const data = await apPaymentsService.getDashboard(companyId, branchId)
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

  // POST /ap-payments/:id/proof
  async uploadProof(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId    = req.user?.id             ?? ''
      const id = req.params.id as string
      const payment   = await apPaymentsService.uploadProof(id, req.body, companyId, userId)
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
