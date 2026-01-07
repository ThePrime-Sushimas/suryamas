import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { bankAccountsService } from './bankAccounts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { OwnerType } from './bankAccounts.types'

export class BankAccountsController {
  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const account = await bankAccountsService.createBankAccount(req.body)
      sendSuccess(res, account, 'Bank account created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await bankAccountsService.getBankAccounts(req.query)
      sendSuccess(res, result.data, 'Bank accounts retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const account = await bankAccountsService.getBankAccountById(id)
      sendSuccess(res, account, 'Bank account retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const account = await bankAccountsService.updateBankAccount(id, req.body)
      sendSuccess(res, account, 'Bank account updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      await bankAccountsService.deleteBankAccount(id, userId)
      sendSuccess(res, null, 'Bank account deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getByOwner = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const ownerType = req.params.owner_type === 'companies' ? 'company' : 'supplier'
      const ownerId = req.params.id
      const accounts = await bankAccountsService.getBankAccountsByOwner(ownerType as OwnerType, ownerId)
      sendSuccess(res, accounts, 'Bank accounts retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const bankAccountsController = new BankAccountsController()
