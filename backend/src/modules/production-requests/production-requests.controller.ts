import type { Request, Response } from 'express'
import { productionRequestsService } from './production-requests.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  productionRequestIdSchema, productionRequestListSchema,
  createProductionRequestSchema, updateProductionRequestSchema,
  acceptProductionRequestSchema, receiveProductionRequestSchema,
  cancelProductionRequestSchema,
} from './production-requests.schema'

type ListReq = ValidatedAuthRequest<typeof productionRequestListSchema>
type IdReq = ValidatedAuthRequest<typeof productionRequestIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createProductionRequestSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateProductionRequestSchema>
type AcceptReq = ValidatedAuthRequest<typeof acceptProductionRequestSchema>
type ReceiveReq = ValidatedAuthRequest<typeof receiveProductionRequestSchema>
type CancelReq = ValidatedAuthRequest<typeof cancelProductionRequestSchema>

async function scope(req: Request) {
  const userId = req.user?.id ?? ''
  const branchIds = await getAccessibleBranchIds(userId)
  return { userId, branchIds }
}

export class ProductionRequestsController {

  summary = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id ?? ''
      const { getAccessibleCompanyIds } = await import('../../utils/branch-access.util')
      const companyIds = await getAccessibleCompanyIds(userId)
      const companyId = companyIds[0]
      if (!companyId) { sendSuccess(res, [], 'No company access'); return }

      const filter: Record<string, string> = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      const data = await productionRequestsService.summary(companyId, filter)
      sendSuccess(res, data, 'Production request summary retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'summary_production_requests' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await scope(req)
      const { query } = (req as ListReq).validated
      const page = parseInt(query.page ?? '1') || 1
      const limit = parseInt(query.limit ?? '25') || 25

      const filter: Record<string, unknown> = {}
      if (query.status) filter.status = query.status
      if (query.requesting_branch_id) filter.requesting_branch_id = query.requesting_branch_id
      if (query.fulfilling_branch_id) filter.fulfilling_branch_id = query.fulfilling_branch_id
      if (query.date_from) filter.date_from = query.date_from
      if (query.date_to) filter.date_to = query.date_to
      if (query.search) filter.search = query.search

      const result = await productionRequestsService.list(branchIds, { page, limit }, filter)
      sendSuccess(res, result.data, 'Production requests retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_production_requests' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds } = await scope(req)
      const result = await productionRequestsService.getById(id, branchIds)
      sendSuccess(res, result, 'Production request retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_production_request', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const { branchIds, userId } = await scope(req)
      const result = await productionRequestsService.create(branchIds, { ...body, created_by: userId })
      sendSuccess(res, result, 'Production request created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_production_request' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const { branchIds, userId } = await scope(req)
      const result = await productionRequestsService.update(params.id, branchIds, { ...body, updated_by: userId })
      sendSuccess(res, result, 'Production request updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_production_request', id: req.params.id })
    }
  }

  accept = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as AcceptReq).validated
      const { branchIds, userId } = await scope(req)
      const result = await productionRequestsService.accept(params.id, branchIds, {
        ...body,
        accepted_by: userId,
      })
      sendSuccess(res, result, 'Production request accepted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'accept_production_request', id: req.params.id })
    }
  }

  receive = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ReceiveReq).validated
      const { branchIds, userId } = await scope(req)
      const result = await productionRequestsService.receive(params.id, branchIds, {
        ...body,
        received_by: userId,
      })
      sendSuccess(res, result, 'Production request received')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'receive_production_request', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as CancelReq).validated
      const { branchIds, userId } = await scope(req)
      const result = await productionRequestsService.cancel(params.id, branchIds, {
        cancelled_by: userId,
        cancel_reason: body?.cancel_reason,
      })
      sendSuccess(res, result, 'Production request cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_production_request', id: req.params.id })
    }
  }

  softDelete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await scope(req)
      await productionRequestsService.softDelete(id, branchIds, userId)
      sendSuccess(res, null, 'Production request deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_production_request', id: req.params.id })
    }
  }
}

export const productionRequestsController = new ProductionRequestsController()
