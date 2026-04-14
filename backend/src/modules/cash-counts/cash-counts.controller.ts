import { Response } from 'express'
import { cashCountsService } from './cash-counts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  previewSchema, createCashCountSchema, cashCountIdSchema,
  updatePhysicalCountSchema, createDepositSchema, depositIdSchema, cashCountListQuerySchema,
} from './cash-counts.schema'

export class CashCountsController {
  preview = withValidated(async (req: ValidatedAuthRequest<typeof previewSchema>, res: Response) => {
    try {
      const { start_date, end_date, payment_method_id } = req.validated.query
      const result = await cashCountsService.preview(start_date, end_date, payment_method_id, req.context?.company_id!)
      sendSuccess(res, result, 'Preview loaded')
    } catch (error: any) { handleError(res, error) }
  })

  create = withValidated(async (req: ValidatedAuthRequest<typeof createCashCountSchema>, res: Response) => {
    try {
      const result = await cashCountsService.create(req.validated.body, req.context?.company_id!, req.context?.employee_id)
      sendSuccess(res, result, 'Cash count created', 201)
    } catch (error: any) { handleError(res, error) }
  })

  list = withValidated(async (req: ValidatedAuthRequest<typeof cashCountListQuerySchema>, res: Response) => {
    try {
      const result = await cashCountsService.list(req.validated.query, req.context?.company_id!)
      sendSuccess(res, result.data, 'Cash counts retrieved', 200, result.pagination)
    } catch (error: any) { handleError(res, error) }
  })

  findById = withValidated(async (req: ValidatedAuthRequest<typeof cashCountIdSchema>, res: Response) => {
    try {
      const result = await cashCountsService.getById(req.validated.params.id)
      sendSuccess(res, result, 'Cash count retrieved')
    } catch (error: any) { handleError(res, error) }
  })

  updatePhysicalCount = withValidated(async (req: ValidatedAuthRequest<typeof updatePhysicalCountSchema>, res: Response) => {
    try {
      const result = await cashCountsService.updatePhysicalCount(req.validated.params.id, req.validated.body, req.context?.employee_id)
      sendSuccess(res, result, 'Physical count updated')
    } catch (error: any) { handleError(res, error) }
  })

  createDeposit = withValidated(async (req: ValidatedAuthRequest<typeof createDepositSchema>, res: Response) => {
    try {
      const result = await cashCountsService.createDeposit(req.validated.body, req.context?.company_id!, req.context?.employee_id)
      sendSuccess(res, result, 'Deposit created', 201)
    } catch (error: any) { handleError(res, error) }
  })

  getDeposit = withValidated(async (req: ValidatedAuthRequest<typeof depositIdSchema>, res: Response) => {
    try {
      const result = await cashCountsService.getDeposit(req.validated.params.id)
      sendSuccess(res, result, 'Deposit retrieved')
    } catch (error: any) { handleError(res, error) }
  })

  deleteDeposit = withValidated(async (req: ValidatedAuthRequest<typeof depositIdSchema>, res: Response) => {
    try {
      await cashCountsService.deleteDeposit(req.validated.params.id, req.context?.employee_id)
      sendSuccess(res, null, 'Deposit deleted')
    } catch (error: any) { handleError(res, error) }
  })

  close = withValidated(async (req: ValidatedAuthRequest<typeof cashCountIdSchema>, res: Response) => {
    try {
      const result = await cashCountsService.close(req.validated.params.id, req.context?.employee_id)
      sendSuccess(res, result, 'Cash count closed')
    } catch (error: any) { handleError(res, error) }
  })

  delete = withValidated(async (req: ValidatedAuthRequest<typeof cashCountIdSchema>, res: Response) => {
    try {
      await cashCountsService.delete(req.validated.params.id, req.context?.employee_id)
      sendSuccess(res, null, 'Cash count deleted')
    } catch (error: any) { handleError(res, error) }
  })
}

export const cashCountsController = new CashCountsController()
