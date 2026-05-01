import { Request, Response } from 'express'
import { bankAccountsService } from './bankAccounts.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountIdSchema,
  bankAccountListQuerySchema,
  ownerBankAccountsSchema,
} from './bankAccounts.schema'

type CreateReq = ValidatedAuthRequest<typeof createBankAccountSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateBankAccountSchema>
type IdReq = ValidatedAuthRequest<typeof bankAccountIdSchema>
type ListReq = ValidatedAuthRequest<typeof bankAccountListQuerySchema>
type OwnerReq = ValidatedAuthRequest<typeof ownerBankAccountsSchema>

export class BankAccountsController {
  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const userId = req.context?.employee_id
      const account = await bankAccountsService.createBankAccount(body, userId)
      sendSuccess(res, account, 'Bank account created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_bank_account' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await bankAccountsService.getBankAccounts(query)
      sendSuccess(res, result.data, 'Bank accounts retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_bank_accounts' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      const account = await bankAccountsService.getBankAccountById(id)
      sendSuccess(res, account, 'Bank account retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_bank_account', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const validated = (req as UpdateReq).validated
      const id = parseInt(validated.params.id)
      const userId = req.context?.employee_id
      const account = await bankAccountsService.updateBankAccount(id, validated.body, userId)
      sendSuccess(res, account, 'Bank account updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_bank_account', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt((req as IdReq).validated.params.id)
      const employeeId = req.context?.employee_id
      await bankAccountsService.deleteBankAccount(id, employeeId)
      sendSuccess(res, null, 'Bank account deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_bank_account', id: req.params.id })
    }
  }

  getByOwner = async (req: Request, res: Response) => {
    try {
      const { params } = (req as OwnerReq).validated
      const ownerType = params.owner_type === 'companies' ? 'company' : 'supplier'
      const accounts = await bankAccountsService.getBankAccountsByOwner(ownerType, params.id)
      sendSuccess(res, accounts, 'Bank accounts retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_bank_accounts_by_owner', owner_type: req.params.owner_type, id: req.params.id })
    }
  }
}

export const bankAccountsController = new BankAccountsController()
