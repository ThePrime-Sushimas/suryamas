import type { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import { pettyCashService } from './petty-cash.service'

async function pcScope(req: Request) {
  const userId = req.user?.id ?? ''
  const branchIds = await getAccessibleBranchIds(userId)
  return { userId, branchIds }
}

export class PettyCashController {
  // ─── Requests ───────────────────────────────────────────────────────────────

  async listRequests(req: Request, res: Response): Promise<void> {
    try {
      const { branchIds } = await pcScope(req)
      const result = await pettyCashService.listRequests(req.query as Record<string, string>, branchIds)
      sendSuccess(res, result.data, 'Petty cash requests retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_petty_cash_requests' })
    }
  }

  async getRequest(req: Request, res: Response): Promise<void> {
    try {
      const { branchIds } = await pcScope(req)
      const result = await pettyCashService.getRequest(req.params.id as string, branchIds)
      sendSuccess(res, result, 'Petty cash request retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_petty_cash_request', id: req.params.id })
    }
  }

  async createRequest(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      const result = await pettyCashService.createRequest(req.body, branchIds, userId)
      sendSuccess(res, result, 'Petty cash request created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_petty_cash_request' })
    }
  }

  async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      const result = await pettyCashService.approveRequest(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, result, 'Request approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_petty_cash_request', id: req.params.id })
    }
  }

  async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      const result = await pettyCashService.rejectRequest(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, result, 'Request rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_petty_cash_request', id: req.params.id })
    }
  }

  // ─── Expenses ───────────────────────────────────────────────────────────────

  async listExpenses(req: Request, res: Response): Promise<void> {
    try {
      const { branchIds } = await pcScope(req)
      const result = await pettyCashService.listExpenses(req.params.id as string, req.query as Record<string, string>, branchIds)
      sendSuccess(res, result.data, 'Expenses retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_petty_cash_expenses', request_id: req.params.id })
    }
  }

  async createExpense(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      const result = await pettyCashService.createExpense(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, result, 'Expense created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_petty_cash_expense', request_id: req.params.id })
    }
  }

  async updateExpense(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      const result = await pettyCashService.updateExpense(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, result, 'Expense updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_petty_cash_expense', id: req.params.id })
    }
  }

  async deleteExpense(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      await pettyCashService.deleteExpense(req.params.id as string, branchIds, userId)
      sendSuccess(res, null, 'Expense deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_petty_cash_expense', id: req.params.id })
    }
  }

  // ─── Settlement ─────────────────────────────────────────────────────────────

  async createSettlement(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      const result = await pettyCashService.createSettlement(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, result, 'Settlement created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_petty_cash_settlement', request_id: req.params.id })
    }
  }

  async voidSettlement(req: Request, res: Response): Promise<void> {
    try {
      const { userId, branchIds } = await pcScope(req)
      await pettyCashService.voidSettlement(req.params.id as string, req.body, branchIds, userId)
      sendSuccess(res, null, 'Settlement voided')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'void_petty_cash_settlement', id: req.params.id })
    }
  }

  // ─── Report ─────────────────────────────────────────────────────────────────

  async getExpenseReport(req: Request, res: Response): Promise<void> {
    try {
      const { branchIds } = await pcScope(req)
      const result = await pettyCashService.getExpenseReport(req.query as Record<string, string>, branchIds)
      sendSuccess(res, result.data, 'Report retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_petty_cash_expense_report' })
    }
  }
}

export const pettyCashController = new PettyCashController()
