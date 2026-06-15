import type { Request, Response } from 'express'
import { wasteReportService } from './waste-report.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { wasteReportQuerySchema, wasteReportByBranchSchema, wasteReportCompareSchema } from './waste-report.schema'
import { getBranchReadScope, requireBranchAccess } from '../../utils/branch-access.util'
import type { WasteReportFilter } from './waste-report.types'

type QueryReq = ValidatedAuthRequest<typeof wasteReportQuerySchema>
type ByBranchReq = ValidatedAuthRequest<typeof wasteReportByBranchSchema>
type CompareReq = ValidatedAuthRequest<typeof wasteReportCompareSchema>

function buildFilter(req: Request, branchIds: string[]): WasteReportFilter {
  const { query } = (req as QueryReq).validated
  if (query.branch_id) requireBranchAccess(query.branch_id, branchIds)

  return {
    branch_ids: branchIds,
    branch_id: query.branch_id,
    start_date: new Date(`${query.start_date}T00:00:00.000Z`),
    end_date: new Date(`${query.end_date}T00:00:00.000Z`),
    item_id: query.item_id,
    category_id: query.category_id,
    source: query.source,
  }
}

function buildByBranchFilter(req: Request, branchIds: string[]): WasteReportFilter {
  const { query } = (req as ByBranchReq).validated

  return {
    branch_ids: branchIds,
    start_date: new Date(`${query.start_date}T00:00:00.000Z`),
    end_date: new Date(`${query.end_date}T00:00:00.000Z`),
    category_id: query.category_id,
    source: query.source,
  }
}

function buildCompareFilters(
  req: Request,
  branchIds: string[],
): { filterA: WasteReportFilter; filterB: WasteReportFilter } {
  const { query } = (req as CompareReq).validated
  if (query.branch_id) requireBranchAccess(query.branch_id, branchIds)

  const shared = {
    branch_ids: branchIds,
    branch_id: query.branch_id,
    category_id: query.category_id,
    source: query.source,
  }

  return {
    filterA: {
      ...shared,
      start_date: new Date(`${query.period_a_start}T00:00:00.000Z`),
      end_date: new Date(`${query.period_a_end}T00:00:00.000Z`),
    },
    filterB: {
      ...shared,
      start_date: new Date(`${query.period_b_start}T00:00:00.000Z`),
      end_date: new Date(`${query.period_b_end}T00:00:00.000Z`),
    },
  }
}

export class WasteReportController {
  getReport = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const result = await wasteReportService.getWasteReport(filter)
      sendSuccess(res, result, 'Waste report retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report' })
    }
  }

  getSummary = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const summary = await wasteReportService.getSummary(filter)
      sendSuccess(res, summary, 'Waste report summary retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report_summary' })
    }
  }

  getByItem = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const groups = await wasteReportService.getByItem(filter)
      sendSuccess(res, groups, 'Waste report by item retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report_by_item' })
    }
  }

  getByReason = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const groups = await wasteReportService.getByReason(filter)
      sendSuccess(res, groups, 'Waste report by reason retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report_by_reason' })
    }
  }

  getMonthlySelisih = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const rows = await wasteReportService.getMonthlySelisih(filter)
      sendSuccess(res, rows, 'Monthly opname selisih retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report_monthly_selisih' })
    }
  }

  getByBranch = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildByBranchFilter(req, branchIds)
      const groups = await wasteReportService.getByBranch(filter)
      sendSuccess(res, groups, 'Waste report by branch retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report_by_branch' })
    }
  }

  compare = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const { filterA, filterB } = buildCompareFilters(req, branchIds)
      const result = await wasteReportService.compare(filterA, filterB)
      sendSuccess(res, result, 'Waste report comparison retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_report_compare' })
    }
  }
}

export const wasteReportController = new WasteReportController()
