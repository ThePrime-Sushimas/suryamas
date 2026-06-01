import type { Request, Response } from 'express'
import { stockAdjustmentsService } from './stock-adjustments.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  adjustmentIdSchema, adjustmentListSchema, createAdjustmentSchema, cancelAdjustmentSchema,
} from './stock-adjustments.schema'

type ListReq = ValidatedAuthRequest<typeof adjustmentListSchema>
type IdReq = ValidatedAuthRequest<typeof adjustmentIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createAdjustmentSchema>
type CancelReq = ValidatedAuthRequest<typeof cancelAdjustmentSchema>

async function adjustmentScope(req: Request) {
  const userId = req.user?.id ?? ''
  const branchIds = await getAccessibleBranchIds(userId)
  return { userId, branchIds }
}

export class StockAdjustmentsController {

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await adjustmentScope(req)
      const { query } = (req as ListReq).validated
      const page = parseInt(query.page ?? '1') || 1
      const limit = parseInt(query.limit ?? '25') || 25

      const filter: Record<string, unknown> = {}
      if (query.adjustment_type) filter.adjustment_type = query.adjustment_type
      if (query.status) filter.status = query.status
      if (query.branch_id) filter.branch_id = query.branch_id
      if (query.date_from) filter.date_from = query.date_from
      if (query.date_to) filter.date_to = query.date_to
      if (query.search) filter.search = query.search

      const result = await stockAdjustmentsService.list(branchIds, { page, limit }, filter)
      sendSuccess(res, result.data, 'Stock adjustments retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_stock_adjustments' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds } = await adjustmentScope(req)
      const result = await stockAdjustmentsService.getById(id, branchIds)
      sendSuccess(res, result, 'Stock adjustment retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_stock_adjustment', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const { branchIds, userId } = await adjustmentScope(req)
      const result = await stockAdjustmentsService.create(branchIds, { ...body, created_by: userId })
      sendSuccess(res, result, 'Stock adjustment created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_stock_adjustment' })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await adjustmentScope(req)
      const result = await stockAdjustmentsService.confirm(id, branchIds, { confirmed_by: userId })
      sendSuccess(res, result, 'Stock adjustment confirmed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_stock_adjustment', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { params } = (req as CancelReq).validated
      const { branchIds, userId } = await adjustmentScope(req)
      const result = await stockAdjustmentsService.cancel(params.id, branchIds, { cancelled_by: userId })
      sendSuccess(res, result, 'Stock adjustment cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_stock_adjustment', id: req.params.id })
    }
  }

  softDelete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await adjustmentScope(req)
      await stockAdjustmentsService.softDelete(id, branchIds, userId)
      sendSuccess(res, null, 'Stock adjustment deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_stock_adjustment', id: req.params.id })
    }
  }

  deleteJournal = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await adjustmentScope(req)
      const result = await stockAdjustmentsService.deleteJournal(id, branchIds, userId)
      sendSuccess(res, result, 'Adjustment journal deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_adjustment_journal', id: req.params.id })
    }
  }

  generateJournal = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await adjustmentScope(req)
      const result = await stockAdjustmentsService.generateJournal(id, branchIds, userId)
      sendSuccess(res, result, 'Journal generated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'generate_adjustment_journal', id: req.params.id })
    }
  }
}

export const stockAdjustmentsController = new StockAdjustmentsController()
