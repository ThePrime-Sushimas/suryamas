import { Response } from 'express'
import { banksService } from './banks.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import {
  createBankSchema,
  updateBankSchema,
  bankIdSchema,
  bankListQuerySchema,
} from './banks.schema'

type CreateBankReq = ValidatedRequest<typeof createBankSchema>
type UpdateBankReq = ValidatedRequest<typeof updateBankSchema>
type BankIdReq = ValidatedRequest<typeof bankIdSchema>
type ListBankReq = ValidatedRequest<typeof bankListQuerySchema>


export class BanksController {
  create = withValidated(async (req: CreateBankReq, res: Response) => {
    try {
      const bank = await banksService.createBank(req.validated.body)
      sendSuccess(res, bank, 'Bank created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  list = withValidated(async (req: ListBankReq, res: Response) => {
    try {
      const result = await banksService.getBanks(req.validated.query)
      sendSuccess(res, result.data, 'Banks retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  findById = withValidated(async (req: BankIdReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const bank = await banksService.getBankById(id)
      sendSuccess(res, bank, 'Bank retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateBankReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const bank = await banksService.updateBank(id, req.validated.body)
      sendSuccess(res, bank, 'Bank updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = withValidated(async (req: BankIdReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      await banksService.deleteBank(id)
      sendSuccess(res, null, 'Bank deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  getOptions = async (req: any, res: Response): Promise<void> => {
    try {
      const options = await banksService.getBankOptions()
      sendSuccess(res, options, 'Bank options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const banksController = new BanksController()
