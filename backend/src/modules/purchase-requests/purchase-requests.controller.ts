import type { Request, Response } from 'express'
import { purchaseRequestsService } from './purchase-requests.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  createPurchaseRequestSchema, updatePurchaseRequestSchema, purchaseRequestIdSchema,
  rejectSchema, approveAndGenerateSchema
} from './purchase-requests.schema'

type CreateReq = ValidatedAuthRequest<typeof createPurchaseRequestSchema>
type UpdateReq = ValidatedAuthRequest<typeof updatePurchaseRequestSchema>
type IdReq = ValidatedAuthRequest<typeof purchaseRequestIdSchema>
type RejectReq = ValidatedAuthRequest<typeof rejectSchema>
type ApproveAndGenerateReq = ValidatedAuthRequest<typeof approveAndGenerateSchema>

export class PurchaseRequestsController {
  list = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const search = req.query.q as string | undefined

      const branchIds = await getAccessibleBranchIds(userId)
      const filter: { status?: string; branch_id?: string; date_from?: string; date_to?: string } = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string

      const result = await purchaseRequestsService.list(branchIds, { page, limit }, filter, search)
      sendSuccess(res, result.data, 'Purchase requests retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purchase_requests' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const branchIds = await getAccessibleBranchIds(req.user?.id ?? '')
      const pr = await purchaseRequestsService.getById(id, branchIds)
      sendSuccess(res, pr, 'Purchase request retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purchase_request', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      const pr = await purchaseRequestsService.create(branchIds, body, userId)
      sendSuccess(res, pr, 'Purchase request created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purchase_request' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      const pr = await purchaseRequestsService.update(params.id, branchIds, body, userId)
      sendSuccess(res, pr, 'Purchase request updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purchase_request', id: req.params.id })
    }
  }

  submitForApproval = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      await purchaseRequestsService.submitForApproval(id, branchIds, userId)
      sendSuccess(res, null, 'Purchase request submitted for approval')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_purchase_request', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as RejectReq).validated
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      await purchaseRequestsService.reject(params.id, branchIds, { rejected_reason: body.rejected_reason, rejected_by: userId })
      sendSuccess(res, null, 'Purchase request rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_purchase_request', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      await purchaseRequestsService.cancel(id, branchIds, userId)
      sendSuccess(res, null, 'Purchase request cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_purchase_request', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      await purchaseRequestsService.delete(id, branchIds, userId)
      sendSuccess(res, null, 'Purchase request deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purchase_request', id: req.params.id })
    }
  }

  getApprovalData = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const branchIds = await getAccessibleBranchIds(req.user?.id ?? '')
      const data = await purchaseRequestsService.getApprovalData(id, branchIds)
      sendSuccess(res, data, 'Approval data retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_approval_data', id: req.params.id })
    }
  }

  approveAndGenerate = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ApproveAndGenerateReq).validated
      const userId = req.user?.id ?? ''
      const branchIds = await getAccessibleBranchIds(userId)
      const result = await purchaseRequestsService.approveAndGenerate(params.id, branchIds, body, userId)
      sendSuccess(res, result, `${result.po_ids.length} PO berhasil dibuat`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_and_generate', id: req.params.id })
    }
  }
}

export const purchaseRequestsController = new PurchaseRequestsController()
