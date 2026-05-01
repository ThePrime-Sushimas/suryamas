import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { bankMutationEntriesService } from './bank-mutation-entries.service'
import type {
  reconcileWithMutationEntrySchema,
  voidMutationEntrySchema,
  mutationEntryIdSchema,
  listMutationEntriesSchema,
  coaSuggestionsSchema,
} from './bank-mutation-entries.schema'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'

export class BankMutationEntriesController {
  async reconcile(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof reconcileWithMutationEntrySchema>).validated
      const userId = req.user?.id
      const companyId = req.context?.company_id

      if (!userId || !companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await bankMutationEntriesService.reconcileWithMutationEntry(body, userId, companyId)
      sendSuccess(res, result, 'Bank mutation entry berhasil dibuat & direconcile', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reconcile_mutation_entry' })
    }
  }

  async voidEntry(req: Request, res: Response): Promise<void> {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof voidMutationEntrySchema>).validated
      const userId = req.user?.id
      const companyId = req.context?.company_id

      if (!userId || !companyId) { sendError(res, 'Unauthorized', 401); return }

      await bankMutationEntriesService.voidEntry(params.id, { voidReason: body.voidReason }, userId, companyId)
      sendSuccess(res, null, 'Bank mutation entry berhasil di-void')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'void_mutation_entry' })
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof listMutationEntriesSchema>).validated
      const companyId = req.context?.company_id

      if (!companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await bankMutationEntriesService.list({
        companyId,
        bankAccountId: query.bankAccountId,
        entryType: query.entryType,
        status: query.status,
        isReconciled: query.isReconciled,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        search: query.search,
        page: query.page,
        limit: query.limit,
      })

      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_mutation_entries' })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof mutationEntryIdSchema>).validated
      const companyId = req.context?.company_id

      if (!companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await bankMutationEntriesService.getById(params.id, companyId)
      sendSuccess(res, result)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_mutation_entry' })
    }
  }

  async getCoaSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof coaSuggestionsSchema>).validated
      const companyId = req.context?.company_id

      if (!companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await bankMutationEntriesService.getCoaSuggestions(query.entryType, companyId)
      sendSuccess(res, result)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_coa_suggestions' })
    }
  }
}

export const bankMutationEntriesController = new BankMutationEntriesController()
