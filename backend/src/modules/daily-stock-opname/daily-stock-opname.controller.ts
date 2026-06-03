import type { Request, Response } from 'express'
import type { AuthRequest } from '../../types/common.types'
import { dailyStockOpnameService } from './daily-stock-opname.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, getAccessibleCompanyIds, getCompanyIdForBranch, requireBranchAccess, requireCompanyAccess, resolveContextCompanyId } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  listSchema, getByIdSchema, createOpnameSchema, updateLineSchema,
  bulkUpdateLinesSchema, photoUploadSchema, confirmSchema, resolveSchema,
  cancelSchema, configSchema, dashboardSchema, varianceReportSchema,
} from './daily-stock-opname.schema'

type ListReq = ValidatedAuthRequest<typeof listSchema>
type GetByIdReq = ValidatedAuthRequest<typeof getByIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createOpnameSchema>
type UpdateLineReq = ValidatedAuthRequest<typeof updateLineSchema>
type BulkUpdateLinesReq = ValidatedAuthRequest<typeof bulkUpdateLinesSchema>
type PhotoUploadReq = ValidatedAuthRequest<typeof photoUploadSchema>
type ConfirmReq = ValidatedAuthRequest<typeof confirmSchema>
type ResolveReq = ValidatedAuthRequest<typeof resolveSchema>
type CancelReq = ValidatedAuthRequest<typeof cancelSchema>
type ConfigReq = ValidatedAuthRequest<typeof configSchema>
type DashboardReq = ValidatedAuthRequest<typeof dashboardSchema>
type VarianceReportReq = ValidatedAuthRequest<typeof varianceReportSchema>

async function opnameScope(req: Request) {
  const userId = req.user?.id ?? ''
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return {
    userId,
    branchIds,
    companyIds,
    companyId: resolveContextCompanyId(req.context?.company_id ?? '', companyIds),
    contextBranchId: req.context?.branch_id ?? '',
  }
}

export class DailyStockOpnameController {

  // ─── LIST / GET ─────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await opnameScope(req)
      const { query } = (req as ListReq).validated
      const page = query.page ?? 1
      const limit = query.limit ?? 25

      const filter: Record<string, unknown> = {}
      if (query.branch_id) {
        requireBranchAccess(query.branch_id, branchIds)
        filter.branch_id = query.branch_id
      }
      if (query.status) filter.status = query.status
      if (query.date_from) filter.date_from = query.date_from
      if (query.date_to) filter.date_to = query.date_to

      const result = await dailyStockOpnameService.list(branchIds, { page, limit }, filter, query.search)
      sendSuccess(res, result.data, 'Opname list retrieved', 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_opname' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as GetByIdReq).validated.params
      const { branchIds } = await opnameScope(req)
      const result = await dailyStockOpnameService.getById(id, branchIds)
      sendSuccess(res, result, 'Opname detail retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_opname', id: req.params.id })
    }
  }

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const { branchIds, userId } = await opnameScope(req)
      requireBranchAccess(body.branch_id, branchIds)
      const result = await dailyStockOpnameService.createSession(branchIds, body, userId)
      sendSuccess(res, result, 'Opname session created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_opname' })
    }
  }

  // ─── AVAILABLE POSITIONS ────────────────────────────────────────────────────

  getAvailablePositions = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds } = await opnameScope(req)
      const branchId = (req.query.branch_id as string) || req.context?.branch_id || ''
      if (branchId) requireBranchAccess(branchId, branchIds)
      const result = await dailyStockOpnameService.getAvailablePositions(userId, branchId)
      sendSuccess(res, result, 'Available positions retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_opname_positions' })
    }
  }

  // ─── LINE UPDATES ──────────────────────────────────────────────────────────

  updateLine = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateLineReq).validated
      const { branchIds, userId } = await opnameScope(req)
      const result = await dailyStockOpnameService.updateLine(params.id, params.lineId, branchIds, body, userId)
      sendSuccess(res, result, 'Line updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_opname_line', id: req.params.id })
    }
  }

  bulkUpdateLines = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as BulkUpdateLinesReq).validated
      const { branchIds, userId } = await opnameScope(req)
      const result = await dailyStockOpnameService.bulkUpdateLines(params.id, branchIds, body, userId)
      sendSuccess(res, result, 'Lines updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_opname_lines', id: req.params.id })
    }
  }

  uploadPhoto = async (req: Request, res: Response) => {
    try {
      const { params } = (req as PhotoUploadReq).validated
      const { branchIds, userId } = await opnameScope(req)
      const file = req.file
      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }
      const result = await dailyStockOpnameService.uploadPhoto(
        params.id, params.lineId, branchIds, file.buffer, file.originalname, file.mimetype, userId,
      )
      sendSuccess(res, result, 'Photo uploaded')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_opname_photo', id: req.params.id })
    }
  }

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  confirm = async (req: Request, res: Response) => {
    try {
      const { params } = (req as ConfirmReq).validated
      const { branchIds, userId } = await opnameScope(req)
      const result = await dailyStockOpnameService.confirmSession(params.id, branchIds, userId)
      sendSuccess(res, result, 'Opname confirmed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_opname', id: req.params.id })
    }
  }

  resolve = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ResolveReq).validated
      const { branchIds, userId } = await opnameScope(req)
      const result = await dailyStockOpnameService.resolve(params.id, branchIds, body, userId)
      sendSuccess(res, result, 'Opname resolved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'resolve_opname', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { params } = (req as CancelReq).validated
      const { branchIds, userId } = await opnameScope(req)
      // Check if user has delete permission (manager-level) for authorization in service
      const hasDeletePerm = !!(req as AuthRequest).permissions?.daily_stock_opname?.delete
      await dailyStockOpnameService.cancel(params.id, branchIds, userId, hasDeletePerm)
      sendSuccess(res, null, 'Opname cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_opname', id: req.params.id })
    }
  }

  // ─── CONFIG ─────────────────────────────────────────────────────────────────

  getConfig = async (req: Request, res: Response) => {
    try {
      const { branchId } = (req as ConfigReq).validated.params
      const { branchIds } = await opnameScope(req)
      requireBranchAccess(branchId, branchIds)
      const result = await dailyStockOpnameService.getConfig(branchId)
      sendSuccess(res, result, 'Config retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_opname_config' })
    }
  }

  updateConfig = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ConfigReq).validated
      const { branchIds, companyIds, userId } = await opnameScope(req)
      requireBranchAccess(params.branchId, branchIds)
      const companyId = (await getCompanyIdForBranch(params.branchId)) ?? ''
      requireCompanyAccess(companyId, companyIds)
      const result = await dailyStockOpnameService.upsertConfig(params.branchId, companyId, body, userId)
      sendSuccess(res, result, 'Config updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_opname_config' })
    }
  }

  // ─── DASHBOARD & REPORTS ────────────────────────────────────────────────────

  getDashboard = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await opnameScope(req)
      const result = await dailyStockOpnameService.getDashboard(branchIds)
      sendSuccess(res, result, 'Dashboard retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_opname_dashboard' })
    }
  }

  getVarianceReport = async (req: Request, res: Response) => {
    try {
      const { query } = (req as VarianceReportReq).validated
      const { branchIds } = await opnameScope(req)
      const result = await dailyStockOpnameService.getVarianceReport(branchIds, query)
      sendSuccess(res, result, 'Variance report retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_variance_report' })
    }
  }

  exportVarianceReportCsv = async (req: Request, res: Response) => {
    try {
      const { query } = (req as VarianceReportReq).validated
      const { branchIds } = await opnameScope(req)
      const csvBuffer = await dailyStockOpnameService.exportVarianceReport(branchIds, query)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="variance-report.csv"')
      res.send(csvBuffer)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_variance_report' })
    }
  }
}

export const dailyStockOpnameController = new DailyStockOpnameController()
