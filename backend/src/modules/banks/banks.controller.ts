import { Response, Request } from 'express'
import { banksService } from './banks.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createBankSchema,
  updateBankSchema,
  bankIdSchema,
  bankListQuerySchema,
} from './banks.schema'

type CreateBankReq = ValidatedAuthRequest<typeof createBankSchema>
type UpdateBankReq = ValidatedAuthRequest<typeof updateBankSchema>
type BankIdReq = ValidatedAuthRequest<typeof bankIdSchema>
type ListBankReq = ValidatedAuthRequest<typeof bankListQuerySchema>

export class BanksController {
  create = withValidated(async (req: CreateBankReq, res: Response) => {
    try {
      const userId = req.context?.employee_id
      const bank = await banksService.createBank(req.validated.body, userId)
      sendSuccess(res, bank, 'Bank created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'create_bank' })
    }
  })

  list = withValidated(async (req: ListBankReq, res: Response) => {
    try {
      const result = await banksService.getBanks(req.validated.query)
      sendSuccess(res, result.data, 'Banks retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'list_banks', query: req.validated?.query })
    }
  })

  findById = withValidated(async (req: BankIdReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const bank = await banksService.getBankById(id)
      sendSuccess(res, bank, 'Bank retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'get_bank', id: req.validated?.params?.id })
    }
  })

  update = withValidated(async (req: UpdateBankReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const userId = req.context?.employee_id
      const bank = await banksService.updateBank(id, req.validated.body, userId)
      sendSuccess(res, bank, 'Bank updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'update_bank', id: req.validated?.params?.id })
    }
  })

  delete = withValidated(async (req: BankIdReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const userId = req.context?.employee_id
      await banksService.deleteBank(id, userId)
      sendSuccess(res, null, 'Bank deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'delete_bank', id: req.validated?.params?.id })
    }
  })

  getOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const options = await banksService.getBankOptions()
      sendSuccess(res, options, 'Bank options retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_bank_options' })
    }
  }
}

export const banksController = new BanksController()
