import { accountingPurposeAccountsRepository, AccountingPurposeAccountsRepository } from './accounting-purpose-accounts.repository'
import { 
  AccountingPurposeAccount, 
  CreateAccountingPurposeAccountDTO, 
  UpdateAccountingPurposeAccountDTO,
  AccountingPurposeAccountWithDetails,
  BulkCreateAccountingPurposeAccountDTO,
  BulkRemoveAccountingPurposeAccountDTO
} from './accounting-purpose-accounts.types'
import { PaginatedResponse, createPaginatedResponse } from '../../../utils/pagination.util'
import { ExportService } from '../../../services/export.service'
import { AuditService } from '../../../services/audit.service'
import { AccountingPurposeAccountErrors } from './accounting-purpose-accounts.errors'
import { AccountingPurposeAccountsConfig } from './accounting-purpose-accounts.constants'
import { logInfo, logError } from '../../../config/logger'
import { supabase } from '../../../config/supabase'

export class AccountingPurposeAccountsService {
  constructor(private repository: AccountingPurposeAccountsRepository = accountingPurposeAccountsRepository) {}

  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ): Promise<PaginatedResponse<AccountingPurposeAccountWithDetails>> {
    const { data, total } = await this.repository.findAll(companyId, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async create(data: CreateAccountingPurposeAccountDTO, companyId: string, userId: string): Promise<AccountingPurposeAccount> {
    logInfo('Creating purpose account mapping', { 
      purpose_id: data.purpose_id,
      account_id: data.account_id,
      side: data.side
    })
    
    return await this.repository.withTransaction(async (trx) => {
      try {
        // Check for duplicate mapping
        const existing = await this.repository.findByPurposeAndAccount(
          data.purpose_id, 
          data.account_id, 
          data.side,
          trx
        )
        if (existing) {
          throw AccountingPurposeAccountErrors.DUPLICATE_MAPPING(
            data.purpose_id, 
            data.account_id, 
            data.side
          )
        }

        const purposeAccount = await this.repository.create(data, companyId, userId, trx)

        if (!purposeAccount) {
          throw AccountingPurposeAccountErrors.CREATE_FAILED()
        }

        logInfo('Purpose account mapping created successfully', { id: purposeAccount.id })
        return purposeAccount
      } catch (error: any) {
        logError('Failed to create purpose account mapping', { 
          error: error.message, 
          purpose_id: data.purpose_id,
          account_id: data.account_id
        })
        throw error
      }
    })
  }

  async getById(id: string, companyId?: string): Promise<AccountingPurposeAccount> {
    const purposeAccount = await this.repository.findById(id)
    if (!purposeAccount) {
      throw AccountingPurposeAccountErrors.NOT_FOUND(id)
    }
    
    if (companyId && purposeAccount.company_id !== companyId) {
      throw AccountingPurposeAccountErrors.COMPANY_ACCESS_DENIED(companyId)
    }
    
    return purposeAccount
  }

  async update(id: string, data: UpdateAccountingPurposeAccountDTO, userId: string, companyId?: string): Promise<AccountingPurposeAccount> {
    logInfo('Updating purpose account mapping', { id, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      const existing = await this.repository.findById(id, trx)
      if (!existing) {
        throw AccountingPurposeAccountErrors.NOT_FOUND(id)
      }

      if (companyId && existing.company_id !== companyId) {
        throw AccountingPurposeAccountErrors.COMPANY_ACCESS_DENIED(companyId)
      }

      try {
        // If side is being changed, validate balance rules
        if (data.side && data.side !== existing.side) {
          const { data: account, error } = await supabase
            .from('chart_of_accounts')
            .select('account_type, normal_balance')
            .eq('id', existing.account_id)
            .maybeSingle()

          if (error) throw new Error(error.message)
          if (account) {
            this.validateBalanceSide(account.account_type, account.normal_balance, data.side)
          }
        }

        const updatedData = {
          ...data,
          updated_by: userId
        }

        const purposeAccount = await this.repository.update(id, updatedData, trx)
        if (!purposeAccount) {
          throw AccountingPurposeAccountErrors.UPDATE_FAILED()
        }

        await AuditService.log('UPDATE', 'accounting_purpose_account', id, userId, existing, purposeAccount)
        logInfo('Purpose account mapping updated successfully', { id })
        return purposeAccount
      } catch (error: any) {
        logError('Failed to update purpose account mapping', { error: error.message, id })
        throw error
      }
    })
  }

  async delete(id: string, userId: string, companyId?: string): Promise<void> {
    logInfo('Deleting purpose account mapping', { id, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      const purposeAccount = await this.repository.findById(id, trx)
      if (!purposeAccount) {
        throw AccountingPurposeAccountErrors.NOT_FOUND(id)
      }

      if (companyId && purposeAccount.company_id !== companyId) {
        throw AccountingPurposeAccountErrors.COMPANY_ACCESS_DENIED(companyId)
      }

      await this.repository.delete(id, userId, trx)
      await AuditService.log('DELETE', 'accounting_purpose_account', id, userId, purposeAccount, null)
      logInfo('Purpose account mapping deleted successfully', { id })
    })
  }

  async bulkCreate(data: BulkCreateAccountingPurposeAccountDTO, companyId: string, userId: string): Promise<AccountingPurposeAccount[]> {
    logInfo('Bulk creating purpose account mappings', { 
      purpose_id: data.purpose_id,
      count: data.accounts.length,
      user: userId 
    })
    
    return await this.repository.withTransaction(async (trx) => {
      try {
        // Validate purpose exists
        const { data: purpose, error: purposeError } = await supabase
          .from('accounting_purposes')
          .select('id')
          .eq('id', data.purpose_id)
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .maybeSingle()

        if (purposeError) throw new Error(purposeError.message)
        if (!purpose) {
          throw AccountingPurposeAccountErrors.PURPOSE_NOT_FOUND(data.purpose_id)
        }

        // Validate all accounts exist and are postable
        for (const accountData of data.accounts) {
          const { data: account, error } = await supabase
            .from('chart_of_accounts')
            .select('id, account_code, account_type, normal_balance, is_postable')
            .eq('id', accountData.account_id)
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .maybeSingle()

          if (error) throw new Error(error.message)
          if (!account) {
            throw AccountingPurposeAccountErrors.ACCOUNT_NOT_FOUND(accountData.account_id)
          }

          if (!account.is_postable) {
            throw AccountingPurposeAccountErrors.ACCOUNT_NOT_POSTABLE(account.account_code)
          }

          this.validateBalanceSide(account.account_type, account.normal_balance, accountData.side)

          // Check for duplicate mapping
          const existing = await this.repository.findByPurposeAndAccount(
            data.purpose_id, 
            accountData.account_id, 
            accountData.side,
            trx
          )
          if (existing) {
            throw AccountingPurposeAccountErrors.DUPLICATE_MAPPING(
              data.purpose_id, 
              accountData.account_id, 
              accountData.side
            )
          }
        }

        const purposeAccounts = await this.repository.bulkCreate(
          data.purpose_id,
          data.accounts,
          companyId,
          userId,
          trx
        )

        await AuditService.log('BULK_CREATE', 'accounting_purpose_account', data.purpose_id, userId, null, { count: purposeAccounts.length })
        logInfo('Bulk create completed', { count: purposeAccounts.length })
        return purposeAccounts
      } catch (error: any) {
        logError('Failed to bulk create purpose account mappings', { 
          error: error.message, 
          purpose_id: data.purpose_id,
          user: userId 
        })
        throw AccountingPurposeAccountErrors.BULK_OPERATION_FAILED('create')
      }
    })
  }

  async bulkRemove(data: BulkRemoveAccountingPurposeAccountDTO, userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk removing purpose account mappings', { 
      purpose_id: data.purpose_id,
      count: data.account_ids.length,
      user: userId 
    })
    
    return await this.repository.withTransaction(async (trx) => {
      try {
        // Validate company access if provided
        if (companyId) {
          const { data: purpose, error } = await supabase
            .from('accounting_purposes')
            .select('company_id')
            .eq('id', data.purpose_id)
            .maybeSingle()

          if (error) throw new Error(error.message)
          if (purpose && purpose.company_id !== companyId) {
            throw AccountingPurposeAccountErrors.COMPANY_ACCESS_DENIED(companyId)
          }
        }

        await this.repository.bulkRemove(data.purpose_id, data.account_ids, userId, trx)
        await AuditService.log('BULK_REMOVE', 'accounting_purpose_account', data.purpose_id, userId, null, { count: data.account_ids.length })
        logInfo('Bulk remove completed', { count: data.account_ids.length })
      } catch (error: any) {
        logError('Failed to bulk remove purpose account mappings', { 
          error: error.message, 
          purpose_id: data.purpose_id,
          user: userId 
        })
        throw AccountingPurposeAccountErrors.BULK_OPERATION_FAILED('remove')
      }
    })
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk updating purpose account status', { count: ids.length, is_active: isActive, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      // Validate company access for all records if companyId provided
      if (companyId) {
        for (const id of ids) {
          const purposeAccount = await this.repository.findById(id, trx)
          if (purposeAccount && purposeAccount.company_id !== companyId) {
            throw AccountingPurposeAccountErrors.COMPANY_ACCESS_DENIED(companyId)
          }
        }
      }

      await this.repository.bulkUpdateStatus(ids, isActive, trx)
      await AuditService.log('BULK_UPDATE_STATUS', 'accounting_purpose_account', ids.join(','), userId, null, { is_active: isActive })
      logInfo('Bulk status update completed', { count: ids.length })
    })
  }

  async exportToExcel(companyId: string, filter?: any): Promise<Buffer> {
    logInfo('Exporting purpose account mappings to Excel', { company_id: companyId, filter })
    const data = await this.repository.exportData(companyId, filter, AccountingPurposeAccountsConfig.EXPORT.MAX_ROWS)
    const columns = [
      { header: 'Purpose Code', key: 'purpose_code', width: 15 },
      { header: 'Purpose Name', key: 'purpose_name', width: 30 },
      { header: 'Account Code', key: 'account_code', width: 15 },
      { header: 'Account Name', key: 'account_name', width: 30 },
      { header: 'Account Type', key: 'account_type', width: 15 },
      { header: 'Side', key: 'side', width: 10 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ]
    return await ExportService.generateExcel(data, columns)
  }

  private validateBalanceSide(accountType: string, normalBalance: string, side: string): void {
    // DEBIT accounts (ASSET, EXPENSE) should typically be on DEBIT side
    // CREDIT accounts (LIABILITY, EQUITY, REVENUE) should typically be on CREDIT side
    // But we allow flexibility for contra accounts and special cases
    
    // Only enforce strict rules for obvious mismatches
    if ((accountType === 'ASSET' || accountType === 'EXPENSE') && normalBalance === 'DEBIT' && side === 'CREDIT') {
      // This might be a contra account, allow it but could add warning
    }
    
    if ((accountType === 'LIABILITY' || accountType === 'EQUITY' || accountType === 'REVENUE') && normalBalance === 'CREDIT' && side === 'DEBIT') {
      // This might be a contra account, allow it but could add warning
    }
    
    // For now, we'll be permissive and not throw errors for balance side mismatches
    // as there are legitimate business cases for contra accounts
  }
}

export const accountingPurposeAccountsService = new AccountingPurposeAccountsService()