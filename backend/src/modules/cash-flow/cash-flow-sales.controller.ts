import { Request, Response } from 'express'
import { cashFlowSalesService } from './cash-flow-sales.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createGroupSchema, updateGroupSchema, deleteGroupSchema, reorderGroupsSchema,
  getCashFlowDailySchema, createPeriodBalanceSchema, updatePeriodBalanceSchema,
  deletePeriodBalanceSchema, getSuggestionSchema, listPeriodsSchema,
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

  createPeriod = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { body } = (req as CreatePeriodReq).validated
      const result = await cashFlowSalesService.createPeriodBalance(
        { company_id: companyId, bank_account_id: body.bank_account_id, period_start: body.period_start, period_end: body.period_end, opening_balance: body.opening_balance, source: body.source, previous_period_id: body.previous_period_id, notes: body.notes, created_by: userId },
        companyId, userId
      )
      sendSuccess(res, result, 'Period created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_period_balance' })
    }
  }

  updatePeriod = async (req: Request, res: Response) => {
    try {
      const validated = (req as UpdatePeriodReq).validated
      const result = await cashFlowSalesService.updatePeriodBalance(validated.params.id, req.context?.company_id ?? '', validated.body, req.user?.id)
      sendSuccess(res, result, 'Period updated', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_period_balance', id: req.params.id })
    }
  }

  deletePeriod = async (req: Request, res: Response) => {
    try {
      const { id } = (req as DeletePeriodReq).validated.params
      await cashFlowSalesService.deletePeriodBalance(id, req.context?.company_id ?? '', req.user?.id)
      sendSuccess(res, null, 'Period deleted', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_period_balance', id: req.params.id })
    }
  }

  listPeriods = async (req: Request, res: Response) => {
    try {
      const q = (req as ListPeriodsReq).validated.query
      const result = await cashFlowSalesService.listPeriodBalances(q.bank_account_id, req.context?.company_id ?? '', q.page, q.limit)
      sendSuccess(res, result.data, 'Periods retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_period_balances' })
    }
  }

  getSuggestion = async (req: Request, res: Response) => {
    try {
      const q = (req as GetSuggestionReq).validated.query
      const result = await cashFlowSalesService.getSuggestion(q.bank_account_id, req.context?.company_id ?? '', q.period_start)
      sendSuccess(res, result, 'Suggestion retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_suggestion' })
    }
  }

  // ── Groups ──

  listGroups = async (req: Request, res: Response) => {
    try {
      const result = await cashFlowSalesService.listGroups(req.context?.company_id ?? '')
      sendSuccess(res, result, 'Groups retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_groups' })
    }
  }

  createGroup = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { body } = (req as CreateGroupReq).validated
      const result = await cashFlowSalesService.createGroup({ ...body, company_id: companyId }, userId)
      sendSuccess(res, result, 'Group created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_group' })
    }
  }

  updateGroup = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { params, body } = (req as UpdateGroupReq).validated
      const result = await cashFlowSalesService.updateGroup(params.id, companyId, body, userId)
      sendSuccess(res, result, 'Group updated successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_group', id: req.params.id })
    }
  }

  deleteGroup = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { params } = (req as DeleteGroupReq).validated
      await cashFlowSalesService.deleteGroup(params.id, companyId, userId)
      sendSuccess(res, null, 'Group deleted successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_group', id: req.params.id })
    }
  }

  reorderGroups = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { body } = (req as ReorderReq).validated
      await cashFlowSalesService.reorderGroups(companyId, body.ordered_ids)
      sendSuccess(res, null, 'Groups reordered successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reorder_groups' })
    }
  }

  getCashFlowDaily = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const q = (req as GetDailyReq).validated.query
      const result = await cashFlowSalesService.getCashFlowDaily(
        { bank_account_id: q.bank_account_id, company_id: companyId, date_from: q.date_from, date_to: q.date_to, branch_id: q.branch_id },
        q.page, q.limit
      )
      sendSuccess(res, result, 'Cash flow daily retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_cash_flow_daily' })
    }
  }

  getBranches = async (req: Request, res: Response) => {
    try {
      const result = await cashFlowSalesService.getBranches(req.context?.company_id ?? '')
      sendSuccess(res, result, 'Branches retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_branches' })
    }
  }
}

export const cashFlowSalesController = new CashFlowSalesController()
