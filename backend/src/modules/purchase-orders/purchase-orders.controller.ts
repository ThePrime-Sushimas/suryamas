import type { Request, Response } from 'express'
import { purchaseOrdersService } from './purchase-orders.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createPurchaseOrderSchema, updatePurchaseOrderSchema, purchaseOrderIdSchema, cancelSchema } from './purchase-orders.schema'

type CreateReq = ValidatedAuthRequest<typeof createPurchaseOrderSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePurchaseOrderSchema>
type IdReq = ValidatedAuthRequest<typeof purchaseOrderIdSchema>
type CancelReq = ValidatedAuthRequest<typeof cancelSchema>

export class PurchaseOrdersController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const search = req.query.q as string | undefined

      const filter: Record<string, unknown> = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.supplier_id) filter.supplier_id = req.query.supplier_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      // Guard: only show POs from branches user has access to
      if (!filter.branch_id) {
        filter.branch_ids = await getAccessibleBranchIds(userId)
      }

      const result = await purchaseOrdersService.list(companyId, { page, limit }, filter, search)
      sendSuccess(res, result.data, 'Purchase orders retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purchase_orders' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const po = await purchaseOrdersService.getById(id, companyId)
      sendSuccess(res, po, 'Purchase order retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_order', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const po = await purchaseOrdersService.create(companyId, body, userId)
      sendSuccess(res, po, 'Purchase order created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purchase_order' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const po = await purchaseOrdersService.update(params.id, companyId, body, userId)
      sendSuccess(res, po, 'Purchase order updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purchase_order', id: req.params.id })
    }
  }

  submitForApproval = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseOrdersService.submitForApproval(id, companyId, userId)
      sendSuccess(res, null, 'Purchase order submitted for approval')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_purchase_order', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseOrdersService.approve(id, companyId, userId)
      sendSuccess(res, null, 'Purchase order approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_purchase_order', id: req.params.id })
    }
  }

  markSent = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseOrdersService.markSent(id, companyId, userId)
      sendSuccess(res, null, 'Purchase order marked as sent')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark_sent_purchase_order', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as CancelReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseOrdersService.cancel(params.id, companyId, userId, body.cancelled_reason)
      sendSuccess(res, null, 'Purchase order cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_purchase_order', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseOrdersService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Purchase order deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purchase_order', id: req.params.id })
    }
  }

  checkDuplicates = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const supplier_id = req.query.supplier_id as string
      const branch_id = req.query.branch_id as string
      const total_amount = parseFloat(req.query.total_amount as string) || 0

      if (!supplier_id || !branch_id) {
        res.status(400).json({ success: false, message: 'supplier_id and branch_id required' })
        return
      }

      const result = await purchaseOrdersService.checkDuplicates(companyId, supplier_id, branch_id, total_amount)
      sendSuccess(res, result, 'Duplicate check completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'check_duplicate_po' })
    }
  }

  getLatestPrice = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const product_id = req.query.product_id as string
      const supplier_id = req.query.supplier_id as string | undefined

      if (!product_id) {
        res.status(400).json({ success: false, message: 'product_id required' })
        return
      }

      const result = await purchaseOrdersService.getLatestPrice(companyId, product_id, supplier_id)
      sendSuccess(res, result, 'Latest price retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_latest_price' })
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController()
