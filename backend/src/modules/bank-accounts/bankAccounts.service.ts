import { bankAccountsRepository } from './bankAccounts.repository'
import { BankAccount, BankAccountWithBank, CreateBankAccountDto, UpdateBankAccountDto, BankAccountListQuery, OwnerType } from './bankAccounts.types'
import {
  BankAccountNotFoundError,
  DuplicateBankAccountError,
  InvalidOwnerError,
  InvalidOwnerTypeError,
  BankNotActiveError,
  BankNotFoundError,
  CoaAccountNotFoundError,
  CoaAccountNotActiveError,
  CoaAccountInvalidTypeError,
  OwnerClosedError,
  OwnerDeletedError,
} from './bankAccounts.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { logInfo } from '../../config/logger'
import { AuditService } from '../monitoring/monitoring.service'

export class BankAccountsService {
  private async validateOwner(ownerType: OwnerType, ownerId: string): Promise<void> {
    if (!['company', 'supplier'].includes(ownerType)) throw new InvalidOwnerTypeError(ownerType, ['company', 'supplier'])
    
    const data = await bankAccountsRepository.findOwner(ownerType, ownerId)
    if (!data) throw new InvalidOwnerError(ownerType, ownerId)
    
    if (ownerType === 'company') {
      if ((data as { status?: string }).status === 'closed') {
        throw new OwnerClosedError('company', ownerId)
      }
    } else {
      if ((data as { deleted_at?: string }).deleted_at) {
        throw new OwnerDeletedError('supplier', ownerId)
      }
    }
  }

  private async validateBank(bankId: number): Promise<void> {
    const data = await bankAccountsRepository.findBank(bankId)
    if (!data) throw new BankNotFoundError(bankId)
    if (!data.is_active) throw new BankNotActiveError(bankId)
  }

  private async validateCoaAccount(coaAccountId: string | null | undefined): Promise<void> {
    if (!coaAccountId) return

    const data = await bankAccountsRepository.findCoaAccount(coaAccountId)
    if (!data) throw new CoaAccountNotFoundError(coaAccountId)
    if (!data.is_active) throw new CoaAccountNotActiveError(coaAccountId)
    if (data.account_type !== 'ASSET') throw new CoaAccountInvalidTypeError(coaAccountId, data.account_type)
  }

  async createBankAccount(data: CreateBankAccountDto, userId?: string): Promise<BankAccount> {
    await this.validateOwner(data.owner_type, data.owner_id)
    await this.validateBank(data.bank_id)
    await this.validateCoaAccount(data.coa_account_id)

    const existing = await bankAccountsRepository.findByAccountNumber(data.bank_id, data.account_number)
    if (existing) throw new DuplicateBankAccountError(data.account_number)

    const account = await bankAccountsRepository.createAtomic(data)

    if (data.is_primary) {
      logInfo('Creating primary bank account', {
        owner_type: data.owner_type,
        owner_id: data.owner_id,
        bank_id: data.bank_id
      })
    }

    if (userId) {
      await AuditService.log('CREATE', 'bank_account', account.id.toString(), userId, undefined, {
        account_number: account.account_number,
        owner_type: account.owner_type,
        owner_id: account.owner_id
      })
    }

    return account
  }

  async updateBankAccount(id: number, data: UpdateBankAccountDto, userId?: string): Promise<BankAccount> {
    const existing = await bankAccountsRepository.findById(id)
    if (!existing) throw new BankAccountNotFoundError(id.toString())

    if (data.account_number) {
      const duplicate = await bankAccountsRepository.findByAccountNumber(existing.bank_id, data.account_number, id)
      if (duplicate) throw new DuplicateBankAccountError(data.account_number)
    }

    if (data.coa_account_id !== undefined) {
      await this.validateCoaAccount(data.coa_account_id)
    }

    const account = await bankAccountsRepository.updateAtomic(id, data)

    if (data.is_primary) {
      logInfo('Updating bank account to primary', {
        account_id: id,
        owner_type: existing.owner_type,
        owner_id: existing.owner_id
      })
    }

    if (userId) {
      await AuditService.log('UPDATE', 'bank_account', id.toString(), userId, {
        account_number: existing.account_number,
        is_primary: existing.is_primary
      }, {
        account_number: account.account_number,
        is_primary: account.is_primary
      })
    }

    return account
  }

  async deleteBankAccount(id: number, employeeId?: string): Promise<void> {
    const account = await bankAccountsRepository.findById(id)
    if (!account) throw new BankAccountNotFoundError(id.toString())

    logInfo('Deleting bank account', {
      account_id: id,
      owner_type: account.owner_type,
      owner_id: account.owner_id,
      deleted_by: employeeId
    })

    await bankAccountsRepository.softDelete(id, employeeId)

    if (employeeId) {
      await AuditService.log('DELETE', 'bank_account', id.toString(), employeeId, {
        account_number: account.account_number,
        owner_type: account.owner_type,
        owner_id: account.owner_id
      })
    }
  }

  async getBankAccountById(id: number): Promise<BankAccountWithBank> {
    const account = await bankAccountsRepository.findById(id)
    if (!account) throw new BankAccountNotFoundError(id.toString())
    return account
  }

  async getBankAccounts(query: BankAccountListQuery) {
    const { page, limit, offset } = getPaginationParams({ ...query })
    const { data, total } = await bankAccountsRepository.findAll({ limit, offset }, query)
    return createPaginatedResponse(data, total, page, limit)
  }

  async getBankAccountsByOwner(ownerType: OwnerType, ownerId: string): Promise<BankAccountWithBank[]> {
    await this.validateOwner(ownerType, ownerId)
    return bankAccountsRepository.findByOwner(ownerType, ownerId)
  }
}

export const bankAccountsService = new BankAccountsService()
