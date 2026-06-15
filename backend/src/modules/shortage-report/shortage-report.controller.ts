import type { Request, Response } from 'express'
import { shortageReportService } from './shortage-report.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAuthUserId } from '../../utils/auth-context.util'
import { getBranchReadScope, requireBranchAccess } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  shortageReportQuerySchema,
  shortageReportByEmployeeSchema,
  shortageDepartmentEmployeesSchema,
  shortageResolveSchema,
  shortageDeductionPaidSchema,
} from './shortage-report.schema'
import type { ShortageReportFilter } from './shortage-report.types'

type QueryReq = ValidatedAuthRequest<typeof shortageReportQuerySchema>
type ByEmployeeReq = ValidatedAuthRequest<typeof shortageReportByEmployeeSchema>
type DepartmentEmployeesReq = ValidatedAuthRequest<typeof shortageDepartmentEmployeesSchema>
type ResolveReq = ValidatedAuthRequest<typeof shortageResolveSchema>
type DeductionPaidReq = ValidatedAuthRequest<typeof shortageDeductionPaidSchema>

function buildFilter(req: Request, branchIds: string[]): ShortageReportFilter {
  const { query } = (req as QueryReq).validated
  if (query.branch_id) requireBranchAccess(query.branch_id, branchIds)

  return {
    branch_ids: branchIds,
    branch_id: query.branch_id,
    position_id: query.position_id,
    start_date: new Date(`${query.start_date}T00:00:00.000Z`),
    end_date: new Date(`${query.end_date}T00:00:00.000Z`),
    item_id: query.item_id,
    category_id: query.category_id,
    resolve_status: query.resolve_status,
  }
}

export class ShortageReportController {
  getReport = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const { query } = (req as QueryReq).validated

      if (query.summary_only === 'true') {
        const summary = await shortageReportService.getSummary(filter)
        sendSuccess(res, { summary }, 'Shortage report summary retrieved')
        return
      }

      const result = await shortageReportService.getReport(filter)
      sendSuccess(res, result, 'Shortage report retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_shortage_report' })
    }
  }

  getByItem = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const filter = buildFilter(req, branchIds)
      const groups = await shortageReportService.getByItem(filter)
      sendSuccess(res, groups, 'Shortage report by item retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_shortage_report_by_item' })
    }
  }

  getByEmployee = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const { query } = (req as ByEmployeeReq).validated
      if (query.branch_id) requireBranchAccess(query.branch_id, branchIds)

      const filter: ShortageReportFilter = {
        branch_ids: branchIds,
        branch_id: query.branch_id,
        start_date: new Date(`${query.start_date}T00:00:00.000Z`),
        end_date: new Date(`${query.end_date}T00:00:00.000Z`),
      }
      const groups = await shortageReportService.getByEmployee(filter)
      sendSuccess(res, groups, 'Shortage report by employee retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_shortage_report_by_employee' })
    }
  }

  getByDepartment = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const { query } = (req as ByEmployeeReq).validated
      if (query.branch_id) requireBranchAccess(query.branch_id, branchIds)

      const filter: ShortageReportFilter = {
        branch_ids: branchIds,
        branch_id: query.branch_id,
        start_date: new Date(`${query.start_date}T00:00:00.000Z`),
        end_date: new Date(`${query.end_date}T00:00:00.000Z`),
      }
      const groups = await shortageReportService.getByDepartment(filter)
      sendSuccess(res, groups, 'Shortage report by department retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_shortage_report_by_department' })
    }
  }

  getDepartmentEmployees = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const { query } = (req as DepartmentEmployeesReq).validated
      requireBranchAccess(query.branch_id, branchIds)
      const employees = await shortageReportService.getDepartmentEmployees(
        query.branch_id,
        query.department_id,
      )
      sendSuccess(res, employees, 'Department employees retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_shortage_department_employees' })
    }
  }

  resolve = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const { body } = (req as ResolveReq).validated
      const userId = getAuthUserId(req)
      const result = await shortageReportService.resolve(branchIds, body, userId)
      sendSuccess(res, result, 'Shortage resolved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'resolve_shortage' })
    }
  }

  markDeductionPaid = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getBranchReadScope(req)
      const { params, body } = (req as DeductionPaidReq).validated
      const userId = getAuthUserId(req)
      const result = await shortageReportService.markDeductionPaid(
        params.id, branchIds, body.paid, userId,
      )
      sendSuccess(res, result, 'Deduction payment status updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark_shortage_deduction_paid', id: req.params.id })
    }
  }
}

export const shortageReportController = new ShortageReportController()
