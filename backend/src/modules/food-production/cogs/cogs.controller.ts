import type { Request, Response } from 'express'
import { cogsService } from './cogs.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { cogsPreviewSchema, cogsFinalizeSchema, cogsIdSchema, cogsListSchema } from './cogs.schema'

type PreviewReq = ValidatedAuthRequest<typeof cogsPreviewSchema>
type FinalizeReq = ValidatedAuthRequest<typeof cogsFinalizeSchema>
type IdReq = ValidatedAuthRequest<typeof cogsIdSchema>
type ListReq = ValidatedAuthRequest<typeof cogsListSchema>

export class CogsController {
  preview = async (req: Request, res: Response) => {
    try {
      const { body } = (req as PreviewReq).validated
      const result = await cogsService.preview(req.context?.company_id ?? '', body)
      sendSuccess(res, result, 'COGS preview calculated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cogs_preview' })
    }
  }

  finalize = async (req: Request, res: Response) => {
    try {
      const { body } = (req as FinalizeReq).validated
      const userId = req.user?.id ?? ''
      const result = await cogsService.finalize(req.context?.company_id ?? '', body, userId)
      sendSuccess(res, result, `COGS finalized — Journal ${result.journal_number} created`, 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cogs_finalize' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const result = await cogsService.getById(id, req.context?.company_id ?? '')
      sendSuccess(res, result, 'COGS calculation retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_cogs_calculation', id: req.params.id })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await cogsService.list(req.context?.company_id ?? '', { page: query.page, limit: query.limit }, {
        period_start: query.period_start,
        period_end: query.period_end,
        branch_id: query.branch_id,
        status: query.status,
      })
      sendSuccess(res, result.data, 'COGS calculations retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_cogs_calculations' })
    }
  }
}

export const cogsController = new CogsController()
