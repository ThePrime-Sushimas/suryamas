import { Request, Response } from 'express'
import { expenseCategorizationService } from './expense-categorization.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createRuleSchema, updateRuleSchema, deleteRuleSchema,
  categorizeManualSchema, uncategorizeSchema, autoCategorizeSchema,
  listUncategorizedSchema, generateJournalSchema,
} from './expense-categorization.schema'

type CreateRuleReq = ValidatedAuthRequest<typeof createRuleSchema>
type UpdateRuleReq = ValidatedAuthRequest<typeof updateRuleSchema>
type DeleteRuleReq = ValidatedAuthRequest<typeof deleteRuleSchema>
type CategorizeManualReq = ValidatedAuthRequest<typeof categorizeManualSchema>
type UncategorizeReq = ValidatedAuthRequest<typeof uncategorizeSchema>
type AutoCategorizeReq = ValidatedAuthRequest<typeof autoCategorizeSchema>
type ListUncategorizedReq = ValidatedAuthRequest<typeof listUncategorizedSchema>
type GenerateJournalReq = ValidatedAuthRequest<typeof generateJournalSchema>

export class ExpenseCategorizationController {
  listRules = async (req: Request, res: Response) => {
    try {
      const result = await expenseCategorizationService.listRules(req.context?.company_id ?? '')
      sendSuccess(res, result, 'Rules retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_rules', company_id: req.context?.company_id })
    }
  }

  createRule = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateRuleReq).validated
      const result = await expenseCategorizationService.createRule(req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, result, 'Rule created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_rule' })
    }
  }

  updateRule = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateRuleReq).validated
      const result = await expenseCategorizationService.updateRule(params.id, req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, result, 'Rule updated', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_rule', id: req.params.id })
    }
  }

  deleteRule = async (req: Request, res: Response) => {
    try {
      const { id } = (req as DeleteRuleReq).validated.params
      await expenseCategorizationService.deleteRule(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'Rule deleted', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_rule', id: req.params.id })
    }
  }

  autoCategorize = async (req: Request, res: Response) => {
    try {
      const { body } = (req as AutoCategorizeReq).validated
      const result = await expenseCategorizationService.autoCategorize(req.context?.company_id ?? '', req.user?.id ?? '', body)
      sendSuccess(res, result, result.categorized > 0 ? `${result.categorized} statements categorized` : 'No matches found', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'auto_categorize', company_id: req.context?.company_id })
    }
  }

  categorizeManual = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CategorizeManualReq).validated
      const count = await expenseCategorizationService.categorizeManual(req.context?.company_id ?? '', body.statement_ids, body.purpose_id, req.user?.id ?? '')
      sendSuccess(res, { count }, `${count} statements categorized`, 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'categorize_manual', company_id: req.context?.company_id })
    }
  }

  uncategorize = async (req: Request, res: Response) => {
    try {
      const { body } = (req as UncategorizeReq).validated
      const count = await expenseCategorizationService.uncategorize(req.context?.company_id ?? '', body.statement_ids, req.user?.id ?? '')
      sendSuccess(res, { count }, `${count} statements uncategorized`, 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'uncategorize', company_id: req.context?.company_id })
    }
  }

  listUncategorized = async (req: Request, res: Response) => {
    try {
      const q = (req as ListUncategorizedReq).validated.query
      const { data, total } = await expenseCategorizationService.listUncategorized(req.context?.company_id ?? '', q, q.page, q.limit)
      const totalPages = Math.ceil(total / q.limit)
      sendSuccess(res, data, 'Uncategorized statements retrieved', 200, {
        total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_uncategorized', company_id: req.context?.company_id })
    }
  }

  generateJournal = async (req: Request, res: Response) => {
    try {
      const { body } = (req as GenerateJournalReq).validated
      const employeeId = req.context?.employee_id
      if (!employeeId) throw new Error('Employee context required for journal generation')

      const result = await expenseCategorizationService.generateJournal(
        req.context?.company_id ?? '', body.statement_ids, employeeId,
        { journal_date: body.journal_date, description: body.description }
      )
      sendSuccess(res, result, `Journal ${result.journal_number} created with ${result.lines_count} lines`, 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'generate_journal', company_id: req.context?.company_id })
    }
  }
}

export const expenseCategorizationController = new ExpenseCategorizationController()
