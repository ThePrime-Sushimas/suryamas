import { bankAccountsRepository } from './bankAccounts.repository'
import { BankAccount, BankAccountWithBank, CreateBankAccountDto, UpdateBankAccountDto, BankAccountListQuery, OwnerType } from './bankAccounts.types'
import { BankAccountNotFoundError, DuplicateBankAccountError, InvalidOwnerError, BankNotActiveError } from './bankAccounts.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { supabase } from '../../config/supabase'
import { logInfo } from '../../config/logger'

export class BankAccountsService {
  // FIX #2 & #3: Whitelist tables and check soft delete
  private async validateOwner(ownerType: OwnerType, ownerId: number): Promise<void> {
    const VALID_TABLES = {
      company: 'companies',
      supplier: 'suppliers'
    } as const
    
    const table = VALID_TABLES[ownerType]
    if (!table) throw new Error('Invalid owner type')
    
    const { data, error } = await supabase
      .from(table)
      .select('id, deleted_at')
      .eq('id', ownerId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new InvalidOwnerError(ownerType, ownerId)
    if (data.deleted_at) throw new Error(`${ownerType} has been deleted and cannot have bank accounts`)
  }

  private async validateBank(bankId: number): Promise<void> {
    const { data, error } = await supabase
      .from('banks')
      .select('id, is_active')
      .eq('id', bankId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new Error(`Bank with ID ${bankId} not found`)
    if (!data.is_active) throw new BankNotActiveError(bankId)
  }

  // FIX #1: Use atomic function to prevent race condition
  async createBankAccount(data: CreateBankAccountDto): Promise<BankAccount> {
    await this.validateOwner(data.owner_type, data.owner_id)
    await this.validateBank(data.bank_id)

    const existing = await bankAccountsRepository.findByAccountNumber(data.bank_id, data.account_number)
    if (existing) {
      throw new DuplicateBankAccountError(data.account_number)
    }

    // FIX #12: Log critical operation
    if (data.is_primary) {
      logInfo('Creating primary bank account', {
        owner_type: data.owner_type,
        owner_id: data.owner_id,
        bank_id: data.bank_id
      })
    }

    return bankAccountsRepository.createAtomic(data)
  }

  // FIX #1: Use atomic function for update
  async updateBankAccount(id: number, data: UpdateBankAccountDto): Promise<BankAccount> {
    const existing = await bankAccountsRepository.findById(id)
    if (!existing) {
      throw new BankAccountNotFoundError(id.toString())
    }

    if (data.account_number) {
      const duplicate = await bankAccountsRepository.findByAccountNumber(
        existing.bank_id,
        data.account_number,
        id
      )
      if (duplicate) {
        throw new DuplicateBankAccountError(data.account_number)
      }
    }

    // FIX #12: Log critical operation
    if (data.is_primary) {
      logInfo('Updating bank account to primary', {
        account_id: id,
        owner_type: existing.owner_type,
        owner_id: existing.owner_id
      })
    }

    return bankAccountsRepository.updateAtomic(id, data)
  }

  // FIX #5: Add userId for audit trail
  async deleteBankAccount(id: number, userId?: number): Promise<void> {
    const account = await bankAccountsRepository.findById(id)
    if (!account) {
      throw new BankAccountNotFoundError(id.toString())
    }

    // FIX #12: Log deletion
    logInfo('Deleting bank account', {
      account_id: id,
      owner_type: account.owner_type,
      owner_id: account.owner_id,
      deleted_by: userId
    })

    await bankAccountsRepository.softDelete(id, userId)
  }

  async getBankAccountById(id: number): Promise<BankAccountWithBank> {
    const account = await bankAccountsRepository.findById(id)
    if (!account) {
      throw new BankAccountNotFoundError(id.toString())
    }
    return account
  }

  async getBankAccounts(query: BankAccountListQuery) {
    const { page, limit, offset } = getPaginationParams(query as any)
    const { data, total } = await bankAccountsRepository.findAll({ limit, offset }, query)
    
    return createPaginatedResponse(data, total, page, limit)
  }

  async getBankAccountsByOwner(ownerType: OwnerType, ownerId: number): Promise<BankAccountWithBank[]> {
    await this.validateOwner(ownerType, ownerId)
    return bankAccountsRepository.findByOwner(ownerType, ownerId)
  }
}

export const bankAccountsService = new BankAccountsService()
