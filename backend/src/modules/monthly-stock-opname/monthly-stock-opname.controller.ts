import type { Request, Response } from 'express'
import { monthlyStockOpnameService } from './monthly-stock-opname.service'
import { monthlyStockOpnameReopenService } from './monthly-stock-opname-reopen.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, requireBranchAccess } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  listSchema, getByIdSchema, createSchema, updateLineSchema,
  bulkUpdateLinesSchema, createReopenRequestSchema, respondReopenRequestSchema,
  getReopenRequestsSchema,
} from './monthly-stock-opname.schema'

type ListReq = ValidatedAuthRequest<typeof listSchema>
type GetByIdReq = ValidatedAuthRequest<typeof getByIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createSchema>
type UpdateLineReq = ValidatedAuthRequest<typeof updateLineSchema>
type BulkUpdateLinesReq = ValidatedAuthRequest<typeof bulkUpdateLinesSchema>
type CreateReopenReq = ValidatedAuthRequest<typeof createReopenRequestSchema>
type RespondReopenReq = ValidatedAuthRequest<typeof respondReopenRequestSchema>
type GetReopenRequestsReq = ValidatedAuthRequest<typeof getReopenRequestsSchema>

async function getScope(req: Request) {
  const userId = req.user?.id ?? ''
  const branchIds = await getAccessibleBranchIds(userId)
  return { userId, branchIds }
}

export class MonthlyStockOpnameController {

  // ─── LIST ───────────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getScope(req)
      const { query } = (req as ListReq).validated
      const page = query.page ?? 1
      const limit = query.limit ?? 25

      const filter: Record<string, unknown> = {}
      if (query.branch_id) {
        requireBranchAccess(query.branch_id, branchIds)
        filter.branch_id = query.branch_id
      }
      if (query.warehouse_id) filter.warehouse_id = query.warehouse_id
      if (query.status) filter.status = query.status
      if (query.date_from) filter.date_from = query.date_from
      if (query.date_to) filter.date_to = query.date_to

      const result = await monthlyStockOpnameService.list(branchIds, { page, limit }, filter, query.search)
      sendSuccess(res, result.data, 'Monthly stock opname list retrieved', 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      })
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── GET BY ID ──────────────────────────────────────────────────────────────

  getById = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getScope(req)
      const { params } = (req as GetByIdReq).validated
      const detail = await monthlyStockOpnameService.getById(params.id, branchIds)
      sendSuccess(res, detail, 'Monthly stock opname detail retrieved')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  create = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { body } = (req as CreateReq).validated
      const result = await monthlyStockOpnameService.createSession(body, branchIds, userId)
      sendSuccess(res, result, 'Monthly stock opname session created', 201)
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── UPDATE LINE ────────────────────────────────────────────────────────────

  updateLine = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as UpdateLineReq).validated
      const result = await monthlyStockOpnameService.updateLine(params.id, params.lineId, body, branchIds, userId)
      sendSuccess(res, result, 'Line updated')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── BULK UPDATE LINES ──────────────────────────────────────────────────────

  bulkUpdateLines = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as BulkUpdateLinesReq).validated
      const result = await monthlyStockOpnameService.bulkUpdateLines(params.id, body, branchIds, userId)
      sendSuccess(res, result, 'Lines updated')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── RECALCULATE EXPECTED ───────────────────────────────────────────────────

  recalculate = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params } = (req as GetByIdReq).validated
      const result = await monthlyStockOpnameService.recalculateExpected(params.id, branchIds, userId)
      sendSuccess(res, result, 'Expected quantities recalculated')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── CONFIRM ───────────────────────────────────────────────────────────────

  confirm = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params } = (req as GetByIdReq).validated
      const result = await monthlyStockOpnameService.confirmSession(params.id, branchIds, userId)
      sendSuccess(res, result, 'Monthly stock opname confirmed')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── CANCEL ─────────────────────────────────────────────────────────────────

  cancel = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params } = (req as GetByIdReq).validated
      await monthlyStockOpnameService.cancelSession(params.id, branchIds, userId)
      sendSuccess(res, null, 'Monthly stock opname cancelled')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── THERMAL PRINT ─────────────────────────────────────────────────────────

  getThermalPrintData = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getScope(req)
      const { params } = (req as GetByIdReq).validated
      const data = await monthlyStockOpnameService.getThermalPrintData(params.id, branchIds)
      sendSuccess(res, data, 'Thermal print data retrieved')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  // ─── REOPEN REQUESTS ───────────────────────────────────────────────────────

  createReopenRequest = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as CreateReopenReq).validated
      const result = await monthlyStockOpnameReopenService.createReopenRequest(params.id, branchIds, userId, body)
      sendSuccess(res, result, 'Reopen request created', 201)
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  approveReopenRequest = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as RespondReopenReq).validated
      const userPermissions = req.user?.permissions
      const result = await monthlyStockOpnameReopenService.approveReopenRequest(
        params.requestId, branchIds, userId, body, userPermissions,
      )
      sendSuccess(res, result, 'Reopen request approved')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  rejectReopenRequest = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as RespondReopenReq).validated
      const userPermissions = req.user?.permissions
      const result = await monthlyStockOpnameReopenService.rejectReopenRequest(
        params.requestId, branchIds, userId, body, userPermissions,
      )
      sendSuccess(res, result, 'Reopen request rejected')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }

  getReopenRequests = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getScope(req)
      const { params } = (req as GetReopenRequestsReq).validated
      const result = await monthlyStockOpnameReopenService.getReopenRequests(params.id, branchIds)
      sendSuccess(res, result, 'Reopen requests retrieved')
    } catch (error: unknown) {
      handleError(error, res)
    }
  }
}

export const monthlyStockOpnameController = new MonthlyStockOpnameController()
