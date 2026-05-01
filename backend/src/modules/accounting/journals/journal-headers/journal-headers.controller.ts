import { Request, Response } from 'express'
import { journalHeadersService } from './journal-headers.service'
import { sendSuccess } from '../../../../utils/response.util'
import { handleError } from '../../../../utils/error-handler.util'
import { getPaginationParams } from '../../../../utils/pagination.util'
import type { ValidatedAuthRequest } from '../../../../middleware/validation.middleware'
import {
  createJournalSchema, updateJournalSchema, rejectJournalSchema, reverseJournalSchema, journalIdSchema,
} from './journal-headers.schema'

function getCompanyId(req: Request): string {
  const companyId = req.context?.company_id
  if (!companyId) throw new Error('Branch context required - no company access')
  return companyId
}

function getEmployeeId(req: Request): string {
  const employeeId = req.context?.employee_id
  if (!employeeId) throw new Error('Employee context required')
  return employeeId
}

export class JournalHeadersController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { offset } = getPaginationParams(req.query)
      const result = await journalHeadersService.list(companyId, { ...req.pagination!, offset }, req.sort as Parameters<typeof journalHeadersService.list>[2], { ...req.filterParams, company_id: companyId })
      sendSuccess(res, result.data, 'Journals retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_journals', company_id: req.context?.company_id })
    }
  }

  listWithLines = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { offset } = getPaginationParams(req.query)
      const result = await journalHeadersService.listWithLines(companyId, { ...req.pagination!, offset }, req.sort as Parameters<typeof journalHeadersService.listWithLines>[2], { ...req.filterParams, company_id: companyId })
      sendSuccess(res, result.data, 'Journals with lines retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_journals_with_lines', company_id: req.context?.company_id })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      const journal = await journalHeadersService.getById(id, companyId)
      sendSuccess(res, journal)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_journal', id: req.params.id })
    }
  }

  getCompleteness = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      const result = await journalHeadersService.getCompleteness(id, companyId)
      sendSuccess(res, result)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_journal_completeness', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { body } = (req as ValidatedAuthRequest<typeof createJournalSchema>).validated
      const branchId = body.branch_id || req.context?.branch_id || undefined
      const journal = await journalHeadersService.create({ ...body, company_id: companyId, branch_id: branchId }, employeeId)
      sendSuccess(res, journal, 'Journal created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_journal' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof updateJournalSchema>).validated
      const journal = await journalHeadersService.update(params.id, body, employeeId, companyId)
      sendSuccess(res, journal, 'Journal updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_journal', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.delete(id, employeeId, companyId)
      sendSuccess(res, null, 'Journal deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_journal', id: req.params.id })
    }
  }

  submit = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.submit(id, employeeId, companyId)
      sendSuccess(res, null, 'Journal submitted for approval')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_journal', id: req.params.id })
    }
  }

  approve = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.approve(id, employeeId, companyId)
      sendSuccess(res, null, 'Journal approved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'approve_journal', id: req.params.id })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof rejectJournalSchema>).validated
      await journalHeadersService.reject(params.id, body.rejection_reason, employeeId, companyId)
      sendSuccess(res, null, 'Journal rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_journal', id: req.params.id })
    }
  }

  post = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.post(id, employeeId, companyId)
      sendSuccess(res, null, 'Journal posted to ledger')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'post_journal', id: req.params.id })
    }
  }

  reverse = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof reverseJournalSchema>).validated
      const journal = await journalHeadersService.getById(params.id, companyId)
      if (journal.status !== 'POSTED' || journal.is_reversed) throw new Error('Cannot reverse this journal')
      const reversal = await journalHeadersService.reverse(params.id, body.reversal_reason, employeeId, companyId)
      sendSuccess(res, reversal, 'Journal reversed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reverse_journal', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.restore(id, employeeId, companyId)
      sendSuccess(res, null, 'Journal restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_journal', id: req.params.id })
    }
  }

  forceDelete = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const employeeId = getEmployeeId(req)
      const { id } = (req as ValidatedAuthRequest<typeof journalIdSchema>).validated.params
      await journalHeadersService.forceDelete(id, employeeId, companyId)
      sendSuccess(res, null, 'Journal force deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'force_delete_journal', id: req.params.id })
    }
  }

  statusCounts = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const dateFrom = req.query?.date_from as string | undefined
      const dateTo = req.query?.date_to as string | undefined
      const result = await journalHeadersService.getStatusCounts(companyId, dateFrom, dateTo)
      sendSuccess(res, result, 'Journal status counts retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_status_counts', company_id: req.context?.company_id })
    }
  }
}

export const journalHeadersController = new JournalHeadersController()
