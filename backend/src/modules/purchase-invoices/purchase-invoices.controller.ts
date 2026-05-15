import type { Request, Response } from 'express'
import { purchaseInvoicesService } from './purchase-invoices.service'
import { handleError } from '../../utils/error-handler.util'
import { sendSuccess } from '../../utils/response.util'

export class PurchaseInvoicesController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt((req.query.page as string) ?? '1', 10)
      const limit = parseInt((req.query.limit as string) ?? '25', 10)

      const filter: any = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.supplier_id) filter.supplier_id = req.query.supplier_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      const result = await purchaseInvoicesService.list(companyId, { page, limit }, filter)
      sendSuccess(res, result.data, 'Purchase invoices retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purchase_invoices' })
    }
  }

  availableGrs = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const supplierId = req.query.supplier_id as string
      const branchId = req.query.branch_id as string
      const result = await purchaseInvoicesService.getAvailableGrs(companyId, supplierId, branchId)
      sendSuccess(res, result, 'Available GRs retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_available_grs' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const id = req.params.id as string
      const detail = await purchaseInvoicesService.getById(id, companyId)
      sendSuccess(res, detail, 'Purchase invoice detail retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_invoice', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const dto = req.body
      const result = await purchaseInvoicesService.create(companyId, dto, userId)
      sendSuccess(res, result, 'Purchase invoice created')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purchase_invoice' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const dto = req.body
      const result = await purchaseInvoicesService.update(companyId, id, dto, userId)
      sendSuccess(res, result, 'Purchase invoice updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purchase_invoice', id: req.params.id })
    }
  }

  submit = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.submit(companyId, id, userId)
      sendSuccess(res, result, 'Purchase invoice submitted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_purchase_invoice', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.approve(companyId, id, userId)
      sendSuccess(res, result, 'Purchase invoice approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_purchase_invoice', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const reason = req.body.rejection_reason as string
      const result = await purchaseInvoicesService.reject(companyId, id, reason, userId)
      sendSuccess(res, result, 'Purchase invoice rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_purchase_invoice', id: req.params.id })
    }
  }

  post = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.post(companyId, id, userId)
      sendSuccess(res, result, 'Purchase invoice posted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_purchase_invoice', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      await purchaseInvoicesService.delete(companyId, id, userId)
      sendSuccess(res, null, 'Purchase invoice deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purchase_invoice', id: req.params.id })
    }
  }
}

export const purchaseInvoicesController = new PurchaseInvoicesController()

