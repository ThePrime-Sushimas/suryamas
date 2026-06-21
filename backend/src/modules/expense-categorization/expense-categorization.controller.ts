import { Request, Response } from 'express'
import { expenseCategorizationService } from './expense-categorization.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleCompanyIds, resolveContextCompanyId } from '../../utils/branch-access.util'
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

async function ecScope(req: Request) {
  const userId = req.user?.id ?? ''
  const companyIds = await getAccessibleCompanyIds(userId)
  return {
    userId,
    companyIds,
    companyId: resolveContextCompanyId(req.context?.company_id ?? '', companyIds),
  }
}

export class ExpenseCategorizationController {
  listRules = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await ecScope(req)
      const result = await expenseCategorizationService.listRules(companyIds)
      sendSuccess(res, result, 'Rules retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_rules' })
    }
  }

  createRule = async (req: Request, res: Response) => {
    try {
      const { companyId, companyIds, userId } = await ecScope(req)
      const { body } = (req as CreateRuleReq).validated
      const result = await expenseCategorizationService.createRule(companyId, companyIds, body, userId)
      sendSuccess(res, result, 'Rule created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_rule' })
    }
  }

  updateRule = async (req: Request, res: Response) => {
    try {
      const { companyId, companyIds, userId } = await ecScope(req)
      const { params, body } = (req as UpdateRuleReq).validated
      const result = await expenseCategorizationService.updateRule(params.id, companyId, companyIds, body, userId)
      sendSuccess(res, result, 'Rule updated', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_rule', id: req.params.id })
    }
  }

  deleteRule = async (req: Request, res: Response) => {
    try {
      const { companyId, companyIds, userId } = await ecScope(req)
      const { id } = (req as DeleteRuleReq).validated.params
      await expenseCategorizationService.deleteRule(id, companyId, companyIds, userId)
      sendSuccess(res, null, 'Rule deleted', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_rule', id: req.params.id })
    }
  }

  autoCategorize = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await ecScope(req)
      const { body } = (req as AutoCategorizeReq).validated
      const result = await expenseCategorizationService.autoCategorize(companyIds, userId, body)
      sendSuccess(res, result, result.categorized > 0 ? `${result.categorized} statements categorized` : 'No matches found', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'auto_categorize' })
    }
  }

  categorizeManual = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await ecScope(req)
      const { body } = (req as CategorizeManualReq).validated
      const count = await expenseCategorizationService.categorizeManual(companyIds, body.statement_ids, body.purpose_id, userId)
      sendSuccess(res, { count }, `${count} statements categorized`, 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'categorize_manual' })
    }
  }

  uncategorize = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await ecScope(req)
      const { body } = (req as UncategorizeReq).validated
      const count = await expenseCategorizationService.uncategorize(companyIds, body.statement_ids, userId)
      sendSuccess(res, { count }, `${count} statements uncategorized`, 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'uncategorize' })
    }
  }

  listUncategorized = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await ecScope(req)
      const q = (req as ListUncategorizedReq).validated.query
      const { data, total } = await expenseCategorizationService.listUncategorized(companyIds, q, q.page, q.limit)
      const totalPages = Math.ceil(total / q.limit)
      sendSuccess(res, data, 'Uncategorized statements retrieved', 200, {
        total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_uncategorized' })
    }
  }

  generateJournal = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await ecScope(req)
      const { body } = (req as GenerateJournalReq).validated
      if (!userId) throw new Error('Authentication required')

      const result = await expenseCategorizationService.generateJournal(
        companyIds, body.statement_ids, userId,
        { journal_date: body.journal_date, description: body.description, branch_id: body.branch_id },
      )
      sendSuccess(res, result, `Journal ${result.journal_number} created with ${result.lines_count} lines`, 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'generate_journal' })
    }
  }
}

export const expenseCategorizationController = new ExpenseCategorizationController()
