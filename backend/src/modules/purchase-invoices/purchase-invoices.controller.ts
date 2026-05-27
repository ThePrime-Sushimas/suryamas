import type { Request, Response } from 'express'
import { purchaseInvoicesService } from './purchase-invoices.service'
import { handleError } from '../../utils/error-handler.util'
import { sendSuccess } from '../../utils/response.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'

async function branchScope(req: Request): Promise<string[]> {
  return getAccessibleBranchIds(req.user?.id ?? '')
}

export class PurchaseInvoicesController {
  list = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? ''
      const page = parseInt((req.query.page as string) ?? '1', 10)
      const limit = parseInt((req.query.limit as string) ?? '25', 10)

      const branchIds = await getAccessibleBranchIds(userId)
      const filter: { status?: string; supplier_id?: string; branch_id?: string; date_from?: string; date_to?: string; search?: string } = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.supplier_id) filter.supplier_id = req.query.supplier_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string
      if (req.query.search) filter.search = req.query.search as string

      const result = await purchaseInvoicesService.list(branchIds, { page, limit }, filter)
      sendSuccess(res, result.data, 'Purchase invoices retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purchase_invoices' })
    }
  }

  availableGrs = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const supplierId = req.query.supplier_id as string
      const branchId = (req.query.branch_id as string) || null
      const result = await purchaseInvoicesService.getAvailableGrs(branchIds, supplierId, branchId)
      sendSuccess(res, result, 'Available GRs retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_available_grs' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const branchIds = await branchScope(req)
      const detail = await purchaseInvoicesService.getById(id, branchIds)
      sendSuccess(res, detail, 'Purchase invoice detail retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_invoice', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const result = await purchaseInvoicesService.create(branchIds, req.body, userId)
      sendSuccess(res, result, 'Purchase invoice created')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purchase_invoice' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.update(id, branchIds, req.body, userId)
      sendSuccess(res, result, 'Purchase invoice updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purchase_invoice', id: req.params.id })
    }
  }

  submit = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.submit(id, branchIds, userId)
      sendSuccess(res, result, 'Purchase invoice submitted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_purchase_invoice', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.approve(id, branchIds, userId)
      sendSuccess(res, result, 'Purchase invoice approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_purchase_invoice', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const reason = req.body.rejection_reason as string
      const result = await purchaseInvoicesService.reject(id, branchIds, reason, userId)
      sendSuccess(res, result, 'Purchase invoice rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_purchase_invoice', id: req.params.id })
    }
  }

  post = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.post(id, branchIds, userId)
      sendSuccess(res, result, 'Purchase invoice posted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_purchase_invoice', id: req.params.id })
    }
  }

  unpost = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.unpost(id, branchIds, userId)
      sendSuccess(res, result, 'Purchase invoice unposted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'unpost_purchase_invoice', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      await purchaseInvoicesService.delete(id, branchIds, userId)
      sendSuccess(res, null, 'Purchase invoice deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purchase_invoice', id: req.params.id })
    }
  }

  getAttachments = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string
      const result = await purchaseInvoicesService.getAttachments(id)
      sendSuccess(res, result, 'Purchase invoice attachments retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_invoice_attachments', id: req.params.id })
    }
  }

  merge = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const { invoice_ids } = req.body
      const result = await purchaseInvoicesService.mergeInvoices(branchIds, invoice_ids, userId)
      sendSuccess(res, result, 'Invoices merged successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'merge_purchase_invoices' })
    }
  }

  split = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await purchaseInvoicesService.splitInvoice(id, branchIds, req.body, userId)
      sendSuccess(res, result, 'Invoice berhasil dipecah')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'split_purchase_invoice', id: req.params.id })
    }
  }

  getCounts = async (req: Request, res: Response) => {
    try {
      const branchIds = await branchScope(req)
      const result = await purchaseInvoicesService.getCounts(branchIds)
      sendSuccess(res, result, 'Invoices counts retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_invoices_counts' })
    }
  }
}

export const purchaseInvoicesController = new PurchaseInvoicesController()
