import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { bankAccountsService } from './bankAccounts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { OwnerType } from './bankAccounts.types'
import { withValidated } from '../../utils/handler'
import type { ValidatedRequest, ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountIdSchema,
  bankAccountListQuerySchema,
} from './bankAccounts.schema'

type CreateBankAccountReq = ValidatedRequest<typeof createBankAccountSchema>
type UpdateBankAccountReq = ValidatedRequest<typeof updateBankAccountSchema>
type BankAccountIdReq = ValidatedAuthRequest<typeof bankAccountIdSchema>
type BankAccountListQueryReq = ValidatedRequest<typeof bankAccountListQuerySchema>


export class BankAccountsController {
  create = withValidated(async (req: CreateBankAccountReq, res: Response) => {
    try {
      const account = await bankAccountsService.createBankAccount(req.validated.body)
      sendSuccess(res, account, 'Bank account created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  list = withValidated(async (req: BankAccountListQueryReq, res: Response) => {
    try {
      const result = await bankAccountsService.getBankAccounts(req.validated.query)
      sendSuccess(res, result.data, 'Bank accounts retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  findById = withValidated(async (req: BankAccountIdReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const account = await bankAccountsService.getBankAccountById(id)
      sendSuccess(res, account, 'Bank account retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateBankAccountReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const account = await bankAccountsService.updateBankAccount(id, req.validated.body)
      sendSuccess(res, account, 'Bank account updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = withValidated(async (req: BankAccountIdReq, res: Response) => {
    try {
      const id = parseInt(req.validated.params.id)
      const employeeId = req.context?.employee_id
      await bankAccountsService.deleteBankAccount(id, employeeId)
      sendSuccess(res, null, 'Bank account deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

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
