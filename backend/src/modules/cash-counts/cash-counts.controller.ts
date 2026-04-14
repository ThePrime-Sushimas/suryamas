import { Response } from 'express'
import { cashCountsService } from './cash-counts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createCashCountSchema,
  cashCountIdSchema,
  updatePhysicalCountSchema,
  depositSchema,
  cashCountListQuerySchema,
} from './cash-counts.schema'

type CreateReq = ValidatedAuthRequest<typeof createCashCountSchema>
type IdReq = ValidatedAuthRequest<typeof cashCountIdSchema>
type CountReq = ValidatedAuthRequest<typeof updatePhysicalCountSchema>
type DepositReq = ValidatedAuthRequest<typeof depositSchema>
type ListReq = ValidatedAuthRequest<typeof cashCountListQuerySchema>

export class CashCountsController {
  create = withValidated(async (req: CreateReq, res: Response) => {
    try {
      const { body } = req.validated
      const companyId = req.context?.company_id!
      const userId = req.context?.employee_id
      const result = await cashCountsService.create(body, companyId, userId)
      sendSuccess(res, result, 'Cash count created', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  list = withValidated(async (req: ListReq, res: Response) => {
    try {
      const { query } = req.validated
      const result = await cashCountsService.list(query)
      sendSuccess(res, result.data, 'Cash counts retrieved', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  findById = withValidated(async (req: IdReq, res: Response) => {
    try {
      const { params } = req.validated
      const result = await cashCountsService.getById(params.id)
      sendSuccess(res, result, 'Cash count retrieved')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  updatePhysicalCount = withValidated(async (req: CountReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const userId = req.context?.employee_id
      const result = await cashCountsService.updatePhysicalCount(params.id, body, userId)
      sendSuccess(res, result, 'Physical count updated')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  deposit = withValidated(async (req: DepositReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const userId = req.context?.employee_id
      const result = await cashCountsService.deposit(params.id, body, userId)
      sendSuccess(res, result, 'Deposit recorded')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  close = withValidated(async (req: IdReq, res: Response) => {
    try {
      const { params } = req.validated
      const userId = req.context?.employee_id
      const result = await cashCountsService.close(params.id, userId)
      sendSuccess(res, result, 'Cash count closed')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = withValidated(async (req: IdReq, res: Response) => {
    try {
      const { params } = req.validated
      const userId = req.context?.employee_id
      await cashCountsService.delete(params.id, userId)
      sendSuccess(res, null, 'Cash count deleted')
    } catch (error: any) {
      handleError(res, error)
    }
  })
}

export const cashCountsController = new CashCountsController()
