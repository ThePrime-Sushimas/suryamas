import type { Request, Response } from 'express'
import { wasteReportService } from './waste-report.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { wasteReportQuerySchema } from './waste-report.schema'
import { getBranchReadScope, requireBranchAccess } from '../../utils/branch-access.util'
import type { WasteReportFilter } from './waste-report.types'

type QueryReq = ValidatedAuthRequest<typeof wasteReportQuerySchema>

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
}

export const wasteReportController = new WasteReportController()
