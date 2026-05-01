import { Request, Response } from 'express'
import { cashCountsService } from './cash-counts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { storageService } from '../../services/storage.service'
import {
  previewSchema, createCashCountSchema, cashCountIdSchema,
  updatePhysicalCountSchema, createDepositSchema, depositIdSchema,
  depositListQuerySchema, capitalReportSchema, cashCountListQuerySchema,
} from './cash-counts.schema'

type PreviewReq = ValidatedAuthRequest<typeof previewSchema>
type CreateReq = ValidatedAuthRequest<typeof createCashCountSchema>
type ListReq = ValidatedAuthRequest<typeof cashCountListQuerySchema>
type IdReq = ValidatedAuthRequest<typeof cashCountIdSchema>
type UpdateCountReq = ValidatedAuthRequest<typeof updatePhysicalCountSchema>
type CreateDepositReq = ValidatedAuthRequest<typeof createDepositSchema>
type DepositIdReq = ValidatedAuthRequest<typeof depositIdSchema>
type DepositListReq = ValidatedAuthRequest<typeof depositListQuerySchema>
type CapitalReportReq = ValidatedAuthRequest<typeof capitalReportSchema>

export class CashCountsController {
  preview = async (req: Request, res: Response) => {
    try {
      const { start_date, end_date, payment_method_id } = (req as PreviewReq).validated.query
      const companyId = req.context?.company_id ?? ''
      const result = await cashCountsService.preview(start_date, end_date, payment_method_id, companyId)
      sendSuccess(res, result, 'Preview loaded')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'preview_cash_counts' })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const companyId = req.context?.company_id ?? ''
      const result = await cashCountsService.create(body, companyId, req.context?.employee_id)
      sendSuccess(res, result, 'Cash count created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_cash_count' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const companyId = req.context?.company_id ?? ''
      const result = await cashCountsService.list(query, companyId)
      sendSuccess(res, result.data, 'Cash counts retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_cash_counts' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const result = await cashCountsService.getById(id)
      sendSuccess(res, result, 'Cash count retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_cash_count', id: req.params.id })
    }
  }

  updatePhysicalCount = async (req: Request, res: Response) => {
    try {
      const validated = (req as UpdateCountReq).validated
      const result = await cashCountsService.updatePhysicalCount(validated.params.id, validated.body, req.context?.employee_id)
      sendSuccess(res, result, 'Physical count updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_physical_count', id: req.params.id })
    }
  }

  createDeposit = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateDepositReq).validated
      const companyId = req.context?.company_id ?? ''
      const result = await cashCountsService.createDeposit(body, companyId, req.context?.employee_id)
      sendSuccess(res, result, 'Deposit created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_deposit' })
    }
  }

  confirmDeposit = async (req: Request, res: Response) => {
    try {
      const { id } = (req as DepositIdReq).validated.params

      const file = req.file
      if (!file) return res.status(400).json({ success: false, message: 'Bukti setoran wajib diupload' })

      const ext = file.originalname.split('.').pop() || 'jpg'
      const fileName = `${id}-${Date.now()}.${ext}`
      const uploaded = await storageService.upload(file.buffer, fileName, file.mimetype, 'buktisetoran')

      const rawDate = req.body?.deposited_at
      const depositedAt: string = (typeof rawDate === 'string' ? rawDate : null) || new Date().toISOString().split('T')[0]
      const result = await cashCountsService.confirmDeposit(id, { proof_url: uploaded.publicUrl, deposited_at: depositedAt }, req.context?.employee_id)
      sendSuccess(res, result, 'Deposit confirmed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_deposit', id: req.params.id })
    }
  }

  revertDeposit = async (req: Request, res: Response) => {
    try {
      const { id } = (req as DepositIdReq).validated.params
      await cashCountsService.revertDeposit(id, req.context?.employee_id)
      sendSuccess(res, null, 'Deposit deleted, cash counts reverted to COUNTED')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'revert_deposit', id: req.params.id })
    }
  }

  getDeposit = async (req: Request, res: Response) => {
    try {
      const { id } = (req as DepositIdReq).validated.params
      const result = await cashCountsService.getDeposit(id)
      sendSuccess(res, result, 'Deposit retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_deposit', id: req.params.id })
    }
  }

  listDeposits = async (req: Request, res: Response) => {
    try {
      const { page, limit } = (req as DepositListReq).validated.query
      const companyId = req.context?.company_id ?? ''
      const result = await cashCountsService.listDeposits(companyId, page, limit)
      sendSuccess(res, result.data, 'Deposits retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_deposits' })
    }
  }

  deleteDeposit = async (req: Request, res: Response) => {
    try {
      const { id } = (req as DepositIdReq).validated.params
      await cashCountsService.deleteDeposit(id, req.context?.employee_id)
      sendSuccess(res, null, 'Deposit deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_deposit', id: req.params.id })
    }
  }

  close = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const result = await cashCountsService.close(id, req.context?.employee_id)
      sendSuccess(res, result, 'Cash count closed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'close_cash_count', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await cashCountsService.delete(id, req.context?.employee_id)
      sendSuccess(res, null, 'Cash count deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_cash_count', id: req.params.id })
    }
  }

  capitalReport = async (req: Request, res: Response) => {
    try {
      const { start_date, end_date } = (req as CapitalReportReq).validated.query
      const companyId = req.context?.company_id ?? ''
      const result = await cashCountsService.getCapitalTopUpReport(companyId, start_date, end_date)
      sendSuccess(res, result, 'Capital top up report')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'capital_report' })
    }
  }
}

export const cashCountsController = new CashCountsController()
