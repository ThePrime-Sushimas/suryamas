import type { Request, Response } from 'express'
import type { AuthRequest } from '../../types/common.types'
import { monthlyStockOpnameService } from './monthly-stock-opname.service'
import { monthlyStockOpnameReopenService } from './monthly-stock-opname-reopen.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, requireBranchAccess } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  listSchema, getByIdSchema, createSchema, updateLineSchema,
  bulkUpdateLinesSchema, createReopenRequestSchema, respondReopenRequestSchema,
  getReopenRequestsSchema, listReopenRequestsSchema,
} from './monthly-stock-opname.schema'

type ListReq = ValidatedAuthRequest<typeof listSchema>
type GetByIdReq = ValidatedAuthRequest<typeof getByIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createSchema>
type UpdateLineReq = ValidatedAuthRequest<typeof updateLineSchema>
type BulkUpdateLinesReq = ValidatedAuthRequest<typeof bulkUpdateLinesSchema>
type CreateReopenReq = ValidatedAuthRequest<typeof createReopenRequestSchema>
type RespondReopenReq = ValidatedAuthRequest<typeof respondReopenRequestSchema>
type GetReopenRequestsReq = ValidatedAuthRequest<typeof getReopenRequestsSchema>
type ListReopenRequestsReq = ValidatedAuthRequest<typeof listReopenRequestsSchema>

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
      await handleError(res, error, req, { action: 'list_monthly_opname' })
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
      await handleError(res, error, req, { action: 'get_monthly_opname', id: req.params.id })
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
      await handleError(res, error, req, { action: 'create_monthly_opname' })
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
      await handleError(res, error, req, { action: 'update_monthly_opname_line', id: req.params.id })
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
      await handleError(res, error, req, { action: 'bulk_update_monthly_opname_lines', id: req.params.id })
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
      await handleError(res, error, req, { action: 'recalculate_monthly_opname', id: req.params.id })
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
      await handleError(res, error, req, { action: 'confirm_monthly_opname', id: req.params.id })
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
      await handleError(res, error, req, { action: 'cancel_monthly_opname', id: req.params.id })
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
      await handleError(res, error, req, { action: 'get_monthly_opname_thermal', id: req.params.id })
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
      await handleError(res, error, req, { action: 'create_monthly_opname_reopen', id: req.params.id })
    }
  }

  approveReopenRequest = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as RespondReopenReq).validated
      const userPermissions = (req as AuthRequest).permissions
      const result = await monthlyStockOpnameReopenService.approveReopenRequest(
        params.requestId, branchIds, userId, body, userPermissions,
      )
      sendSuccess(res, result, 'Reopen request approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_monthly_opname_reopen', id: req.params.requestId })
    }
  }

  rejectReopenRequest = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await getScope(req)
      const { params, body } = (req as RespondReopenReq).validated
      const userPermissions = (req as AuthRequest).permissions
      const result = await monthlyStockOpnameReopenService.rejectReopenRequest(
        params.requestId, branchIds, userId, body, userPermissions,
      )
      sendSuccess(res, result, 'Reopen request rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_monthly_opname_reopen', id: req.params.requestId })
    }
  }

  listReopenRequests = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getScope(req)
      const { query } = (req as ListReopenRequestsReq).validated
      const status = query.status ? (query.status as 'PENDING' | 'APPROVED' | 'REJECTED') : undefined
      const result = await monthlyStockOpnameReopenService.listReopenRequests(branchIds, status)
      sendSuccess(res, result, 'Reopen requests list retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_monthly_opname_reopen_requests' })
    }
  }

  getReopenRequests = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getScope(req)
      const { params } = (req as GetReopenRequestsReq).validated
      const result = await monthlyStockOpnameReopenService.getReopenRequests(params.id, branchIds)
      sendSuccess(res, result, 'Reopen requests retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_monthly_opname_reopen_requests', id: req.params.id })
    }
  }
}

export const monthlyStockOpnameController = new MonthlyStockOpnameController()
