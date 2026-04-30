import { Response } from 'express'
import { expenseCategorizationService } from './expense-categorization.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createRuleSchema, updateRuleSchema, deleteRuleSchema,
  categorizeManualSchema, uncategorizeSchema, autoCategorizeSchema,
  listUncategorizedSchema,
} from './expense-categorization.schema'

type CreateRuleReq = ValidatedAuthRequest<typeof createRuleSchema>
type UpdateRuleReq = ValidatedAuthRequest<typeof updateRuleSchema>
type DeleteRuleReq = ValidatedAuthRequest<typeof deleteRuleSchema>
type CategorizeManualReq = ValidatedAuthRequest<typeof categorizeManualSchema>
type UncategorizeReq = ValidatedAuthRequest<typeof uncategorizeSchema>
type AutoCategorizeReq = ValidatedAuthRequest<typeof autoCategorizeSchema>
type ListUncategorizedReq = ValidatedAuthRequest<typeof listUncategorizedSchema>

export class ExpenseCategorizationController {

  listRules = async (req: any, res: Response) => {
    try {
      const result = await expenseCategorizationService.listRules(String(req.context?.company_id))
      sendSuccess(res, result, 'Rules retrieved', 200)
    } catch (error) { await handleError(res, error, req) }
  }

  createRule = withValidated(async (req: CreateRuleReq, res: Response) => {
    try {
      const result = await expenseCategorizationService.createRule(
        String(req.context?.company_id), req.validated.body, String(req.user?.id)
      )
      sendSuccess(res, result, 'Rule created', 201)
    } catch (error) { await handleError(res, error, req as any) }
  })

  updateRule = withValidated(async (req: UpdateRuleReq, res: Response) => {
    try {
      const result = await expenseCategorizationService.updateRule(
        req.validated.params.id, String(req.context?.company_id), req.validated.body, String(req.user?.id)
      )
      sendSuccess(res, result, 'Rule updated', 200)
    } catch (error) { await handleError(res, error, req as any) }
  })

  deleteRule = withValidated(async (req: DeleteRuleReq, res: Response) => {
    try {
      await expenseCategorizationService.deleteRule(
        req.validated.params.id, String(req.context?.company_id), String(req.user?.id)
      )
      sendSuccess(res, null, 'Rule deleted', 200)
    } catch (error) { await handleError(res, error, req as any) }
  })

  autoCategorize = withValidated(async (req: AutoCategorizeReq, res: Response) => {
    try {
      const result = await expenseCategorizationService.autoCategorize(
        String(req.context?.company_id), String(req.user?.id), req.validated.body
      )
      sendSuccess(res, result, result.categorized > 0 ? `${result.categorized} statements categorized` : 'No matches found', 200)
    } catch (error) { await handleError(res, error, req as any) }
  })

  categorizeManual = withValidated(async (req: CategorizeManualReq, res: Response) => {
    try {
      const count = await expenseCategorizationService.categorizeManual(
        String(req.context?.company_id), req.validated.body.statement_ids, req.validated.body.purpose_id, String(req.user?.id)
      )
      sendSuccess(res, { count }, `${count} statements categorized`, 200)
    } catch (error) { await handleError(res, error, req as any) }
  })

  uncategorize = withValidated(async (req: UncategorizeReq, res: Response) => {
    try {
      const count = await expenseCategorizationService.uncategorize(
        String(req.context?.company_id), req.validated.body.statement_ids, String(req.user?.id)
      )
      sendSuccess(res, { count }, `${count} statements uncategorized`, 200)
    } catch (error) { await handleError(res, error, req as any) }
  })

  listUncategorized = withValidated(async (req: ListUncategorizedReq, res: Response) => {
    try {
      const q = req.validated.query
      const { data, total } = await expenseCategorizationService.listUncategorized(
        String(req.context?.company_id), q, q.page, q.limit
      )
      const totalPages = Math.ceil(total / q.limit)
      sendSuccess(res, data, 'Uncategorized statements retrieved', 200, {
        total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1,
      })
    } catch (error) { await handleError(res, error, req as any) }
  })
}

export const expenseCategorizationController = new ExpenseCategorizationController()
