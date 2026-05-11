import type { Request, Response } from 'express'
import { purchaseRequestsService } from './purchase-requests.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  createPurchaseRequestSchema, updatePurchaseRequestSchema, purchaseRequestIdSchema,
  approveSchema, rejectSchema, approveAndGenerateSchema
} from './purchase-requests.schema'

type CreateReq = ValidatedAuthRequest<typeof createPurchaseRequestSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePurchaseRequestSchema>
type IdReq = ValidatedAuthRequest<typeof purchaseRequestIdSchema>
type RejectReq = ValidatedAuthRequest<typeof rejectSchema>
type ApproveAndGenerateReq = ValidatedAuthRequest<typeof approveAndGenerateSchema>

export class PurchaseRequestsController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const search = req.query.q as string | undefined

      const filter: Record<string, string | undefined> = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string
      // Only filter by branch if explicitly provided
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string

      const result = await purchaseRequestsService.list(companyId, { page, limit }, filter, search)
      sendSuccess(res, result.data, 'Purchase requests retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purchase_requests' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const pr = await purchaseRequestsService.getById(id, companyId)
      sendSuccess(res, pr, 'Purchase request retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_request', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const pr = await purchaseRequestsService.create(companyId, body, userId)
      sendSuccess(res, pr, 'Purchase request created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purchase_request' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const pr = await purchaseRequestsService.update(params.id, companyId, body, userId)
      sendSuccess(res, pr, 'Purchase request updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purchase_request', id: req.params.id })
    }
  }

  submitForApproval = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseRequestsService.submitForApproval(id, companyId, userId)
      sendSuccess(res, null, 'Purchase request submitted for approval')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_purchase_request', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseRequestsService.approve(id, companyId, { approved_by: userId })
      sendSuccess(res, null, 'Purchase request approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_purchase_request', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as RejectReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseRequestsService.reject(params.id, companyId, { rejected_reason: body.rejected_reason, rejected_by: userId })
      sendSuccess(res, null, 'Purchase request rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_purchase_request', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseRequestsService.cancel(id, companyId, userId)
      sendSuccess(res, null, 'Purchase request cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_purchase_request', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await purchaseRequestsService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Purchase request deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purchase_request', id: req.params.id })
    }
  }

  getApprovalData = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const data = await purchaseRequestsService.getApprovalData(id, companyId)
      sendSuccess(res, data, 'Approval data retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_approval_data', id: req.params.id })
    }
  }

  approveAndGenerate = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ApproveAndGenerateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const result = await purchaseRequestsService.approveAndGenerate(params.id, companyId, body, userId)
      sendSuccess(res, result, `${result.po_ids.length} PO berhasil dibuat`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_and_generate', id: req.params.id })
    }
  }
}

export const purchaseRequestsController = new PurchaseRequestsController()
