import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { banksService } from './banks.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

export class BanksController {
  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const bank = await banksService.createBank(req.body)
      sendSuccess(res, bank, 'Bank created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await banksService.getBanks(req.query)
      sendSuccess(res, result.data, 'Banks retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const bank = await banksService.getBankById(id)
      sendSuccess(res, bank, 'Bank retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const bank = await banksService.updateBank(id, req.body)
      sendSuccess(res, bank, 'Bank updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      await banksService.deleteBank(id)
      sendSuccess(res, null, 'Bank deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await banksService.getBankOptions()
      sendSuccess(res, options, 'Bank options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const banksController = new BanksController()
