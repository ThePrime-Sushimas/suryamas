import { Request, Response } from 'express'
import { banksService } from './banks.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { createBankSchema, updateBankSchema, bankIdSchema, bankListQuerySchema } from './banks.schema'

type CreateReq = ValidatedAuthRequest<typeof createBankSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateBankSchema>
type IdReq = ValidatedAuthRequest<typeof bankIdSchema>
type ListReq = ValidatedAuthRequest<typeof bankListQuerySchema>

export class BanksController {
  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const bank = await banksService.createBank(body, req.context?.employee_id)
      sendSuccess(res, bank, 'Bank created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_bank' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await banksService.getBanks(query)
      sendSuccess(res, result.data, 'Banks retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_banks' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      const bank = await banksService.getBankById(id)
      sendSuccess(res, bank, 'Bank retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_bank', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const validated = (req as UpdateReq).validated
      const id = parseInt(validated.params.id)
      const bank = await banksService.updateBank(id, validated.body, req.context?.employee_id)
      sendSuccess(res, bank, 'Bank updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_bank', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      await banksService.deleteBank(id, req.context?.employee_id)
      sendSuccess(res, null, 'Bank deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_bank', id: req.params.id })
    }
  }

  getOptions = async (req: Request, res: Response) => {
    try {
      const options = await banksService.getBankOptions()
      sendSuccess(res, options, 'Bank options retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_bank_options' })
    }
  }
}

export const banksController = new BanksController()
