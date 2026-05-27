import { Request, Response } from 'express'
import { journalHeadersService } from './journal-headers.service'
import { sendSuccess } from '../../../../utils/response.util'
import { handleError } from '../../../../utils/error-handler.util'
import { getPaginationParams } from '../../../../utils/pagination.util'
import { getAuthUserId } from '../../../../utils/auth-context.util'
import type { ValidatedAuthRequest } from '../../../../middleware/validation.middleware'
import {
  createJournalSchema, updateJournalSchema, rejectJournalSchema, reverseJournalSchema, journalIdSchema,
} from './journal-headers.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds } from '../../../../utils/branch-access.util'

async function getAccess(req: Request) {
  const userId = req.user?.id ?? ''
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return { branchIds, companyIds }
}

function getCompanyId(req: Request): string {
  const companyId = req.context?.company_id
  if (!companyId) throw new Error('Branch context required - no company access')
  return companyId
}

export class JournalHeadersController {
  list = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { offset } = getPaginationParams(req.query)
      const result = await journalHeadersService.list(branchIds, companyIds, { ...req.pagination!, offset }, req.sort as import('./journal-headers.types').SortParams | undefined, req.filterParams)
      sendSuccess(res, result.data, 'Journals retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_journals', company_id: req.context?.company_id })
    }
  }

  listWithLines = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { offset } = getPaginationParams(req.query)
      const result = await journalHeadersService.listWithLines(branchIds, companyIds, { ...req.pagination!, offset }, req.sort as import('./journal-headers.types').SortParams | undefined, req.filterParams)
      sendSuccess(res, result.data, 'Journals with lines retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_journals_with_lines', company_id: req.context?.company_id })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      const journal = await journalHeadersService.getByIdForUser(id, branchIds, companyIds)
      sendSuccess(res, journal, 'Journal retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_journal', id: req.params.id })
    }
  }

  getCompleteness = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      const result = await journalHeadersService.getCompleteness(id, branchIds, companyIds)
      sendSuccess(res, result, 'Journal completeness retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_journal_completeness', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const userId = getAuthUserId(req)
      const { body } = (req as ValidatedAuthRequest<typeof createJournalSchema>).validated
      const branchId = req.context?.branch_id
      const journal = await journalHeadersService.create({ ...body, company_id: companyId, branch_id: branchId }, userId)
      sendSuccess(res, journal, 'Journal created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_journal' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof updateJournalSchema>).validated
      const journal = await journalHeadersService.update(params.id, body, userId, branchIds, companyIds)
      sendSuccess(res, journal, 'Journal updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_journal', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.delete(id, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_journal', id: req.params.id })
    }
  }

  submit = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.submit(id, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal submitted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_journal', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.approve(id, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_journal', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof rejectJournalSchema>).validated
      await journalHeadersService.reject(params.id, body.rejection_reason, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_journal', id: req.params.id })
    }
  }

  post = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.post(id, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal posted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_journal', id: req.params.id })
    }
  }

  reverse = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof reverseJournalSchema>).validated
      const reversal = await journalHeadersService.reverse(params.id, body.reversal_reason, userId, branchIds, companyIds)
      sendSuccess(res, reversal, 'Journal reversed', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reverse_journal', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.restore(id, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_journal', id: req.params.id })
    }
  }

  forceDelete = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const userId = getAuthUserId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.forceDelete(id, userId, branchIds, companyIds)
      sendSuccess(res, null, 'Journal force deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'force_delete_journal', id: req.params.id })
    }
  }

  statusCounts = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const dateFrom = req.query?.date_from as string | undefined
      const dateTo = req.query?.date_to as string | undefined
      const result = await journalHeadersService.getStatusCounts(branchIds, companyIds, dateFrom, dateTo)
      sendSuccess(res, result, 'Journal status counts retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_status_counts', company_id: req.context?.company_id })
    }
  }
}

export const journalHeadersController = new JournalHeadersController()
