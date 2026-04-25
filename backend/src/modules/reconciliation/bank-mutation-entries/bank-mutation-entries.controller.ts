import { Response } from 'express'
import { bankMutationEntriesService, BankMutationEntriesService } from './bank-mutation-entries.service'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type {
  reconcileWithMutationEntrySchema,
  voidMutationEntrySchema,
  listMutationEntriesSchema,
  coaSuggestionsSchema,
} from './bank-mutation-entries.schema'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { logError } from '../../../config/logger'
import { AppError } from '../../../utils/errors.base'

type ReqWithContext = { context?: { company_id?: string }; user?: { id?: string } }

export class BankMutationEntriesController {
  constructor(private readonly service: BankMutationEntriesService) {}

  async reconcile(
    req: ValidatedAuthRequest<typeof reconcileWithMutationEntrySchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.body
      const { user, context } = req as unknown as ReqWithContext
      const userId = user?.id
      const companyId = context?.company_id

      if (!userId || !companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await this.service.reconcileWithMutationEntry(validated, userId, companyId)
      sendSuccess(res, result, 'Bank mutation entry berhasil dibuat & direconcile', 201)
    } catch (error: unknown) {
      this.handleError(res, error, 'RECONCILE_MUTATION_ENTRY_FAILED')
    }
  }

  async voidEntry(
    req: ValidatedAuthRequest<typeof voidMutationEntrySchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.validated.params
      const { voidReason } = req.validated.body
      const { user, context } = req as unknown as ReqWithContext
      const userId = user?.id
      const companyId = context?.company_id

      if (!userId || !companyId) { sendError(res, 'Unauthorized', 401); return }

      await this.service.voidEntry(id, { voidReason }, userId, companyId)
      sendSuccess(res, null, 'Bank mutation entry berhasil di-void')
    } catch (error: unknown) {
      this.handleError(res, error, 'VOID_MUTATION_ENTRY_FAILED')
    }
  }

  async list(
    req: ValidatedAuthRequest<typeof listMutationEntriesSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.query
      const { context } = req as unknown as ReqWithContext
      const companyId = context?.company_id

      if (!companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await this.service.list({
        companyId,
        bankAccountId: validated.bankAccountId,
        entryType: validated.entryType,
        status: validated.status,
        isReconciled: validated.isReconciled,
        dateFrom: validated.dateFrom,
        dateTo: validated.dateTo,
        search: validated.search,
        page: validated.page,
        limit: validated.limit,
      })

      sendSuccess(res, result.data, 'Success', 200, result.pagination)
    } catch (error: unknown) {
      this.handleError(res, error, 'LIST_MUTATION_ENTRIES_FAILED')
    }
  }

  async getById(
    req: ValidatedAuthRequest<typeof voidMutationEntrySchema>,
    res: Response,
  ): Promise<void> {
    try {
      const id = req.validated?.params?.id || req.params.id
      const { context } = req as unknown as ReqWithContext
      const companyId = context?.company_id

      if (!companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await this.service.getById(id as string, companyId)
      sendSuccess(res, result)
    } catch (error: unknown) {
      this.handleError(res, error, 'GET_MUTATION_ENTRY_FAILED')
    }
  }

  async getCoaSuggestions(
    req: ValidatedAuthRequest<typeof coaSuggestionsSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { entryType } = req.validated.query
      const { context } = req as unknown as ReqWithContext
      const companyId = context?.company_id

      if (!companyId) { sendError(res, 'Unauthorized', 401); return }

      const result = await this.service.getCoaSuggestions(entryType, companyId)
      sendSuccess(res, result)
    } catch (error: unknown) {
      this.handleError(res, error, 'COA_SUGGESTIONS_FAILED')
    }
  }

  private handleError(res: Response, error: unknown, fallbackCode: string): void {
    if (error instanceof AppError) {
      logError(fallbackCode, { error: error.message, code: error.code })
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      return
    }
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    logError(fallbackCode, { error: message })
    sendError(res, message, 500)
  }
}

export const bankMutationEntriesController = new BankMutationEntriesController(bankMutationEntriesService)
