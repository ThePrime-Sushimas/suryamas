import type { Request, Response } from 'express'
import { pendingJournalPostingService } from './pending-journal-posting.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

class PendingJournalPostingController {
  /**
   * GET /pending-journal-posting
   * List pending records with optional filters + summary counts
   */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id ?? ''
      const query = (req as any).validated?.query ?? req.query
      const result = await pendingJournalPostingService.list(userId, {
        dateFrom: query.date_from,
        dateTo: query.date_to,
        module: query.module,
        branchId: query.branch_id,
        page: query.page ?? 1,
        limit: query.limit ?? 50,
      })
      sendSuccess(res, {
        records: result.data,
        summary: result.summary,
      }, 'Pending journal posting list', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_pending_journal_posting' })
    }
  }

  /**
   * POST /pending-journal-posting/:module/:id/post
   * Post a single record's journal
   */
  postSingle = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id ?? ''
      const { module, id } = (req as any).validated?.params ?? req.params
      const result = await pendingJournalPostingService.postSingle(module, id, userId)
      sendSuccess(res, result, 'Journal berhasil di-post')
    } catch (error: unknown) {
      await handleError(res, error, req, {
        action: 'post_pending_journal',
        module: req.params.module,
        id: req.params.id,
      })
    }
  }

  /**
   * POST /pending-journal-posting/bulk-post
   * Bulk post multiple records in the same module
   */
  postBulk = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id ?? ''
      const body = (req as any).validated?.body ?? req.body
      const result = await pendingJournalPostingService.postBulk(body.module, body.ids, userId)
      sendSuccess(res, result, `Bulk post selesai: ${result.success_count} berhasil, ${result.failure_count} gagal`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_post_pending_journal' })
    }
  }
}

export const pendingJournalPostingController = new PendingJournalPostingController()
