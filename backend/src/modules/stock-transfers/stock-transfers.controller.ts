import type { Request, Response } from 'express'
import { stockTransfersService } from './stock-transfers.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  transferIdSchema, transferListSchema, createTransferSchema, cancelTransferSchema, returnLoanSchema, updateTransferSchema,
} from './stock-transfers.schema'

type ListReq = ValidatedAuthRequest<typeof transferListSchema>
type IdReq = ValidatedAuthRequest<typeof transferIdSchema>
type CreateReq = ValidatedAuthRequest<typeof createTransferSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateTransferSchema>
type CancelReq = ValidatedAuthRequest<typeof cancelTransferSchema>
type ReturnReq = ValidatedAuthRequest<typeof returnLoanSchema>

async function transferScope(req: Request) {
  const userId = req.user?.id ?? ''
  const branchIds = await getAccessibleBranchIds(userId)
  return { userId, branchIds }
}

export class StockTransfersController {

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await transferScope(req)
      const { query } = (req as ListReq).validated
      const page = parseInt(query.page ?? '1') || 1
      const limit = parseInt(query.limit ?? '25') || 25

      const filter: Record<string, unknown> = {}
      if (query.transfer_type) filter.transfer_type = query.transfer_type
      if (query.status) filter.status = query.status
      if (query.source_branch_id) filter.source_branch_id = query.source_branch_id
      if (query.target_branch_id) filter.target_branch_id = query.target_branch_id
      if (query.date_from) filter.date_from = query.date_from
      if (query.date_to) filter.date_to = query.date_to
      if (query.search) filter.search = query.search

      const result = await stockTransfersService.list(branchIds, { page, limit }, filter)
      sendSuccess(res, result.data, 'Stock transfers retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_stock_transfers' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds } = await transferScope(req)
      const result = await stockTransfersService.getById(id, branchIds)
      sendSuccess(res, result, 'Stock transfer retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_stock_transfer', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const { branchIds, userId } = await transferScope(req)
      
      // Keamanan: endpoint ini hanya boleh membuat TRANSFER, tidak boleh LOAN
      if (body.transfer_type === 'LOAN') {
        throw new Error('Hanya pengguna dengan persetujuan yang dapat membuat pinjaman (LOAN)')
      }
      
      const result = await stockTransfersService.create(branchIds, { ...body, created_by: userId })
      sendSuccess(res, result, 'Stock transfer created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_stock_transfer' })
    }
  }

  createLoan = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const { branchIds, userId } = await transferScope(req)
      
      // Keamanan: endpoint ini hanya boleh membuat LOAN, tidak boleh TRANSFER
      if (body.transfer_type !== 'LOAN') {
        throw new Error('Endpoint ini hanya digunakan untuk membuat pinjaman (LOAN)')
      }
      
      const result = await stockTransfersService.create(branchIds, { ...body, created_by: userId })
      sendSuccess(res, result, 'Stock transfer created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_stock_transfer' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const { branchIds, userId } = await transferScope(req)
      const result = await stockTransfersService.update(params.id, branchIds, { ...body, updated_by: userId })
      sendSuccess(res, result, 'Stock transfer updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_stock_transfer', id: req.params.id })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await transferScope(req)
      const result = await stockTransfersService.confirm(id, branchIds, { confirmed_by: userId })
      sendSuccess(res, result, 'Stock transfer confirmed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_stock_transfer', id: req.params.id })
    }
  }

  returnLoan = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as ReturnReq).validated
      const { branchIds, userId } = await transferScope(req)
      const result = await stockTransfersService.returnLoan(params.id, branchIds, {
        returned_by: userId,
        return_date: body.return_date,
      })
      sendSuccess(res, result, 'Loan returned')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'return_loan', id: req.params.id })
    }
  }

  cancel = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as CancelReq).validated
      const { branchIds, userId } = await transferScope(req)
      const result = await stockTransfersService.cancel(params.id, branchIds, {
        cancelled_by: userId,
        cancel_reason: body?.cancel_reason,
      })
      sendSuccess(res, result, 'Stock transfer cancelled')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_stock_transfer', id: req.params.id })
    }
  }

  softDelete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await transferScope(req)
      await stockTransfersService.softDelete(id, branchIds, userId)
      sendSuccess(res, null, 'Stock transfer deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_stock_transfer', id: req.params.id })
    }
  }

  deleteJournals = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { branchIds, userId } = await transferScope(req)
      const result = await stockTransfersService.deleteJournals(id, branchIds, userId)
      sendSuccess(res, result, 'Transfer journals deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_transfer_journals', id: req.params.id })
    }
  }
}

export const stockTransfersController = new StockTransfersController()