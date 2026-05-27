import type { Request, Response } from 'express'
import { dailyPrepOrdersService } from './daily-prep-orders.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, getAccessibleCompanyIds, getCompanyIdForBranch, requireBranchAccess, requireCompanyAccess, resolveContextCompanyId } from '../../utils/branch-access.util'

async function dpoScope(req: Request) {
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
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  dpoIdSchema, dpoLineIdSchema, dpoListSchema, generateDpoSchema,
  updateDpoLinesSchema, confirmDpoSchema, cancelDpoSchema,
  branchIdParamSchema, upsertForecastConfigSchema, upsertHolidaySchema, holidayIdSchema,
} from './daily-prep-orders.schema'

type ListReq = ValidatedAuthRequest<typeof dpoListSchema>
type IdReq = ValidatedAuthRequest<typeof dpoIdSchema>
type LineIdReq = ValidatedAuthRequest<typeof dpoLineIdSchema>
type GenerateReq = ValidatedAuthRequest<typeof generateDpoSchema>
type UpdateLinesReq = ValidatedAuthRequest<typeof updateDpoLinesSchema>
type ConfirmReq = ValidatedAuthRequest<typeof confirmDpoSchema>
type CancelReq = ValidatedAuthRequest<typeof cancelDpoSchema>
type BranchIdReq = ValidatedAuthRequest<typeof branchIdParamSchema>
type UpsertForecastReq = ValidatedAuthRequest<typeof upsertForecastConfigSchema>
type UpsertHolidayReq = ValidatedAuthRequest<typeof upsertHolidaySchema>
type HolidayIdReq = ValidatedAuthRequest<typeof holidayIdSchema>

export class DailyPrepOrdersController {

  // ─── LIST / GET ─────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await dpoScope(req)
      const { query } = (req as ListReq).validated
      const page = parseInt(query.page ?? '1') || 1
      const limit = parseInt(query.limit ?? '25') || 25

      const filter: Record<string, unknown> = {}
      if (query.branch_id) {
        requireBranchAccess(query.branch_id, branchIds)
        filter.branch_id = query.branch_id
      }
      if (query.status) filter.status = query.status
      if (query.date_from) filter.date_from = query.date_from
      if (query.date_to) filter.date_to = query.date_to

      const result = await dailyPrepOrdersService.list(branchIds, { page, limit }, filter)
      sendSuccess(res, result.data, 'DPO list retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_dpo' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds } = await dpoScope(req)
      const result = await dailyPrepOrdersService.getById(id, branchIds)
      sendSuccess(res, result, 'DPO retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_dpo', id: req.params.id })
    }
  }

  // ─── GENERATE ───────────────────────────────────────────────────────────────

  generate = async (req: Request, res: Response) => {
    try {
      const { body } = (req as GenerateReq).validated
      const { branchIds, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.generate(branchIds, { ...body, created_by: userId })
      sendSuccess(res, result, 'DPO generated', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'generate_dpo' })
    }
  }

  // ─── LINES ──────────────────────────────────────────────────────────────────

  updateLines = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateLinesReq).validated
      const { branchIds, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.updateLines(
        params.id, branchIds, { ...body, updated_by: userId }
      )
      sendSuccess(res, result, 'DPO lines updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_dpo_lines', id: req.params.id })
    }
  }

  deleteLine = async (req: Request, res: Response) => {
    try {
      const { id, lineId } = (req as LineIdReq).validated.params
      const { branchIds } = await dpoScope(req)
      const result = await dailyPrepOrdersService.deleteLine(id, branchIds, lineId)
      sendSuccess(res, result, 'DPO line deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_dpo_line', id: req.params.id })
    }
  }

  // ─── LOCK / CONFIRM / CANCEL ────────────────────────────────────────────────

  acquireLock = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.acquireLock(id, branchIds, userId)
      sendSuccess(res, result, 'Lock acquired')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'acquire_dpo_lock', id: req.params.id })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ConfirmReq).validated
      const { branchIds, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.confirm(
        params.id, branchIds, { ...body, confirmed_by: userId }
      )
      sendSuccess(res, result, 'DPO confirmed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_dpo', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { params } = (req as CancelReq).validated
      const { branchIds, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.cancel(params.id, branchIds, userId)
      sendSuccess(res, result, 'DPO deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_dpo', id: req.params.id })
    }
  }

  softDelete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.softDelete(id, branchIds, userId)
      sendSuccess(res, result, 'DPO deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_dpo', id: req.params.id })
    }
  }

  // ─── FORECAST CONFIG ────────────────────────────────────────────────────────

  getForecastConfig = async (req: Request, res: Response) => {
    try {
      const { branchId } = (req as BranchIdReq).validated.params
      const { branchIds, companyIds } = await dpoScope(req)
      requireBranchAccess(branchId, branchIds)
      const companyId = (await getCompanyIdForBranch(branchId)) ?? ''
      requireCompanyAccess(companyId, companyIds)
      const result = await dailyPrepOrdersService.getForecastConfig(companyId, branchId)
      sendSuccess(res, result, 'Forecast config retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_forecast_config' })
    }
  }

  upsertForecastConfig = async (req: Request, res: Response) => {
    try {
      const { body } = (req as UpsertForecastReq).validated
      const { branchIds, companyIds, userId } = await dpoScope(req)
      requireBranchAccess(body.branch_id, branchIds)
      const companyId = (await getCompanyIdForBranch(body.branch_id)) ?? ''
      requireCompanyAccess(companyId, companyIds)
      const result = await dailyPrepOrdersService.upsertForecastConfig(companyId, body, userId)
      sendSuccess(res, result, 'Forecast config saved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upsert_forecast_config' })
    }
  }

  // ─── HOLIDAYS ───────────────────────────────────────────────────────────────

  getHolidays = async (req: Request, res: Response) => {
    try {
      const { companyId } = await dpoScope(req)
      const from = req.query.from as string || new Date().getFullYear() + '-01-01'
      const to = req.query.to as string || new Date().getFullYear() + '-12-31'
      const result = await dailyPrepOrdersService.getHolidays(companyId, from, to)
      sendSuccess(res, result, 'Holidays retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_holidays' })
    }
  }

  upsertHoliday = async (req: Request, res: Response) => {
    try {
      const { body } = (req as UpsertHolidayReq).validated
      const { companyId, userId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.upsertHoliday(companyId, body, userId)
      sendSuccess(res, result, 'Holiday saved', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upsert_holiday' })
    }
  }

  deleteHoliday = async (req: Request, res: Response) => {
    try {
      const { holidayId } = (req as HolidayIdReq).validated.params
      const { companyId } = await dpoScope(req)
      const result = await dailyPrepOrdersService.deleteHoliday(companyId, holidayId)
      sendSuccess(res, { deleted: result }, 'Holiday deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_holiday' })
    }
  }
}

export const dailyPrepOrdersController = new DailyPrepOrdersController()
