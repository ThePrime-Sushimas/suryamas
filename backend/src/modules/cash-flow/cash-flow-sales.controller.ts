import { Response } from 'express'
import { cashFlowSalesService } from './cash-flow-sales.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
  reorderGroupsSchema,
  getCashFlowDailySchema,
  createPeriodBalanceSchema,
  updatePeriodBalanceSchema,
  deletePeriodBalanceSchema,
  getSuggestionSchema,
  listPeriodsSchema,
} from './cash-flow-sales.schema'

type CreateGroupReq = ValidatedAuthRequest<typeof createGroupSchema>
type UpdateGroupReq = ValidatedAuthRequest<typeof updateGroupSchema>
type DeleteGroupReq = ValidatedAuthRequest<typeof deleteGroupSchema>
type ReorderReq = ValidatedAuthRequest<typeof reorderGroupsSchema>
type GetDailyReq = ValidatedAuthRequest<typeof getCashFlowDailySchema>
type CreatePeriodReq = ValidatedAuthRequest<typeof createPeriodBalanceSchema>
type UpdatePeriodReq = ValidatedAuthRequest<typeof updatePeriodBalanceSchema>
type DeletePeriodReq = ValidatedAuthRequest<typeof deletePeriodBalanceSchema>
type GetSuggestionReq = ValidatedAuthRequest<typeof getSuggestionSchema>
type ListPeriodsReq = ValidatedAuthRequest<typeof listPeriodsSchema>

export class CashFlowSalesController {

  // ── Period Balance ──

  createPeriod = withValidated(async (req: CreatePeriodReq, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)
      const { body } = req.validated
      const result = await cashFlowSalesService.createPeriodBalance(
        { company_id: companyId, bank_account_id: body.bank_account_id, period_start: body.period_start, period_end: body.period_end, opening_balance: body.opening_balance, source: body.source, previous_period_id: body.previous_period_id, notes: body.notes, created_by: userId },
        companyId, userId
      )
      sendSuccess(res, result, 'Period created', 201)
    } catch (error: any) { handleError(res, error) }
  })

  updatePeriod = withValidated(async (req: UpdatePeriodReq, res: Response) => {
    try {
      const result = await cashFlowSalesService.updatePeriodBalance(req.validated.params.id, String(req.context?.company_id), req.validated.body, String(req.user?.id))
      sendSuccess(res, result, 'Period updated', 200)
    } catch (error: any) { handleError(res, error) }
  })

  deletePeriod = withValidated(async (req: DeletePeriodReq, res: Response) => {
    try {
      await cashFlowSalesService.deletePeriodBalance(req.validated.params.id, String(req.context?.company_id), String(req.user?.id))
      sendSuccess(res, null, 'Period deleted', 200)
    } catch (error: any) { handleError(res, error) }
  })

  listPeriods = withValidated(async (req: ListPeriodsReq, res: Response) => {
    try {
      const q = req.validated.query
      const result = await cashFlowSalesService.listPeriodBalances(q.bank_account_id, String(req.context?.company_id), q.page, q.limit)
      sendSuccess(res, result.data, 'Periods retrieved', 200, result.pagination)
    } catch (error: any) { handleError(res, error) }
  })

  getSuggestion = withValidated(async (req: GetSuggestionReq, res: Response) => {
    try {
      const q = req.validated.query
      const result = await cashFlowSalesService.getSuggestion(q.bank_account_id, String(req.context?.company_id), q.period_start)
      sendSuccess(res, result, 'Suggestion retrieved', 200)
    } catch (error: any) { handleError(res, error) }
  })

  // ── Groups ──

  listGroups = async (req: any, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const result = await cashFlowSalesService.listGroups(companyId)
      sendSuccess(res, result, 'Groups retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  createGroup = withValidated(async (req: CreateGroupReq, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)
      const { body } = req.validated

      const result = await cashFlowSalesService.createGroup(
        { ...body, company_id: companyId },
        userId
      )
      sendSuccess(res, result, 'Group created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  updateGroup = withValidated(async (req: UpdateGroupReq, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)
      const { params, body } = req.validated

      const result = await cashFlowSalesService.updateGroup(params.id, companyId, body, userId)
      sendSuccess(res, result, 'Group updated successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  deleteGroup = withValidated(async (req: DeleteGroupReq, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)
      const { params } = req.validated

      await cashFlowSalesService.deleteGroup(params.id, companyId, userId)
      sendSuccess(res, null, 'Group deleted successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  reorderGroups = withValidated(async (req: ReorderReq, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const { body } = req.validated

      await cashFlowSalesService.reorderGroups(companyId, body.ordered_ids)
      sendSuccess(res, null, 'Groups reordered successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  getCashFlowDaily = withValidated(async (req: GetDailyReq, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const q = req.validated.query

      const result = await cashFlowSalesService.getCashFlowDaily(
        {
          bank_account_id: q.bank_account_id,
          company_id: companyId,
          date_from: q.date_from,
          date_to: q.date_to,
          branch_id: q.branch_id,
        },
        q.page,
        q.limit
      )

      sendSuccess(res, result, 'Cash flow daily retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  getBranches = async (req: any, res: Response) => {
    try {
      const companyId = String(req.context?.company_id)
      const result = await cashFlowSalesService.getBranches(companyId)
      sendSuccess(res, result, 'Branches retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const cashFlowSalesController = new CashFlowSalesController()
