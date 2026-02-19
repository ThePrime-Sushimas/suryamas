import { bankAccountsRepository } from './bankAccounts.repository'
import { BankAccount, BankAccountWithBank, CreateBankAccountDto, UpdateBankAccountDto, BankAccountListQuery, OwnerType } from './bankAccounts.types'
import { BankAccountNotFoundError, DuplicateBankAccountError, InvalidOwnerError, BankNotActiveError } from './bankAccounts.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { supabase } from '../../config/supabase'
import { logInfo } from '../../config/logger'
import { AuditService } from '../monitoring/monitoring.service'

export class BankAccountsService {
  // FIX #2 & #3: Whitelist tables and check soft delete
  private async validateOwner(ownerType: OwnerType, ownerId: string): Promise<void> {
    const VALID_TABLES = {
      company: 'companies',
      supplier: 'suppliers'
    } as const
    
    const table = VALID_TABLES[ownerType]
    if (!table) throw new Error('Invalid owner type')
    
    // Companies use status field, suppliers use deleted_at
    const selectFields = ownerType === 'company' ? 'id, status' : 'id, deleted_at'
    
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .eq('id', ownerId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new InvalidOwnerError(ownerType, ownerId)
    
    // Check if owner is deleted/inactive
    if (ownerType === 'company') {
      if ((data as any).status === 'closed') {
        throw new Error('This company is closed and cannot have bank accounts')
      }
    } else {
      if ((data as any).deleted_at) {
        throw new Error('This supplier has been deleted and cannot have bank accounts')
      }
    }
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

  private async validateCoaAccount(coaAccountId: string | null | undefined): Promise<void> {
    if (!coaAccountId) return

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id, account_code, account_name, account_type, is_active')
      .eq('id', coaAccountId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new Error(`COA account with ID ${coaAccountId} not found`)
    if (!data.is_active) throw new Error('COA account is not active')
    
    // Optionally validate that COA is an ASSET type (bank accounts should be assets)
    if (data.account_type !== 'ASSET') {
      throw new Error('Bank account should be linked to an ASSET type COA account')
    }
  }

  // FIX #1: Use atomic function to prevent race condition
  async createBankAccount(data: CreateBankAccountDto, userId?: string): Promise<BankAccount> {
    await this.validateOwner(data.owner_type, data.owner_id)
    await this.validateBank(data.bank_id)
    await this.validateCoaAccount(data.coa_account_id)

    const existing = await bankAccountsRepository.findByAccountNumber(data.bank_id, data.account_number)
    if (existing) {
      throw new DuplicateBankAccountError(data.account_number)
    }

    const account = await bankAccountsRepository.createAtomic(data)

    // FIX #12: Log critical operation
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

  // FIX #1: Use atomic function for update
  async updateBankAccount(id: number, data: UpdateBankAccountDto, userId?: string): Promise<BankAccount> {
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

    // Validate COA if provided
    if (data.coa_account_id !== undefined) {
      await this.validateCoaAccount(data.coa_account_id)
    }

    const account = await bankAccountsRepository.updateAtomic(id, data)

    // FIX #12: Log critical operation
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

  // FIX #5: Add employeeId for audit trail
  async deleteBankAccount(id: number, employeeId?: string): Promise<void> {
    const account = await bankAccountsRepository.findById(id)
    if (!account) {
      throw new BankAccountNotFoundError(id.toString())
    }

    // FIX #12: Log deletion
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

  async getBankAccountsByOwner(ownerType: OwnerType, ownerId: string): Promise<BankAccountWithBank[]> {
    await this.validateOwner(ownerType, ownerId)
    return bankAccountsRepository.findByOwner(ownerType, ownerId)
  }
}

export const bankAccountsService = new BankAccountsService()
