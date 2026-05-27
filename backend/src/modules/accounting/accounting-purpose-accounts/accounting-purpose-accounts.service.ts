import { accountingPurposeAccountsRepository, AccountingPurposeAccountsRepository } from './accounting-purpose-accounts.repository'
import {
  AccountingPurposeAccount, CreateAccountingPurposeAccountDTO, UpdateAccountingPurposeAccountDTO,
  AccountingPurposeAccountWithDetails, BulkCreateAccountingPurposeAccountDTO, BulkRemoveAccountingPurposeAccountDTO
} from './accounting-purpose-accounts.types'
import { PaginatedResponse, createPaginatedResponse } from '../../../utils/pagination.util'
import { ExportService } from '../../../services/export.service'
import { AuditService } from '../../monitoring/monitoring.service'
import { AccountingPurposeAccountErrors } from './accounting-purpose-accounts.errors'
import { AccountingPurposeAccountsConfig } from './accounting-purpose-accounts.constants'
import { logInfo, logError } from '../../../config/logger'

export class AccountingPurposeAccountsService {
  constructor(private repository: AccountingPurposeAccountsRepository = accountingPurposeAccountsRepository) {}

  private assertAccessibleCompany(recordCompanyId: string, accessibleCompanyIds: string[]): void {
    if (!accessibleCompanyIds.includes(recordCompanyId)) {
      throw AccountingPurposeAccountErrors.COMPANY_ACCESS_DENIED(recordCompanyId)
    }
  }

  async list(companyIds: string[], pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: Record<string, unknown>): Promise<PaginatedResponse<AccountingPurposeAccountWithDetails>> {
    const { data, total } = await this.repository.findAll(companyIds, pagination, sort, filter as Parameters<typeof this.repository.findAll>[3])
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async create(data: CreateAccountingPurposeAccountDTO, companyId: string, userId: string): Promise<AccountingPurposeAccount> {
    logInfo('Creating purpose account mapping', { purpose_id: data.purpose_id, account_id: data.account_id, side: data.side })

    const purposeExists = await this.repository.purposeExists(data.purpose_id, companyId)
    if (!purposeExists) throw AccountingPurposeAccountErrors.PURPOSE_NOT_FOUND(data.purpose_id)

    const account = await this.repository.findCoaAccount(data.account_id, companyId)
    if (!account) throw AccountingPurposeAccountErrors.ACCOUNT_NOT_FOUND(data.account_id)
    if (!account.is_postable) throw AccountingPurposeAccountErrors.ACCOUNT_NOT_POSTABLE(account.account_code)
    this.validateBalanceSide(account.account_type, account.normal_balance, data.side)

    const existing = await this.repository.findByPurposeAndAccount(data.purpose_id, data.account_id, data.side)
    if (existing) throw AccountingPurposeAccountErrors.DUPLICATE_MAPPING(data.purpose_id, data.account_id, data.side)

    const purposeAccount = await this.repository.create(data, companyId, userId)
    if (!purposeAccount) throw AccountingPurposeAccountErrors.CREATE_FAILED()

    logInfo('Purpose account mapping created', { id: purposeAccount.id })
    return purposeAccount
  }

  async getById(id: string, accessibleCompanyIds: string[]): Promise<AccountingPurposeAccount> {
    const pa = await this.repository.findById(id)
    if (!pa) throw AccountingPurposeAccountErrors.NOT_FOUND(id)
    this.assertAccessibleCompany(pa.company_id, accessibleCompanyIds)
    return pa
  }

  async update(id: string, data: UpdateAccountingPurposeAccountDTO, userId: string, accessibleCompanyIds: string[]): Promise<AccountingPurposeAccount> {
    logInfo('Updating purpose account mapping', { id, user: userId })

    const existing = await this.repository.findById(id)
    if (!existing) throw AccountingPurposeAccountErrors.NOT_FOUND(id)
    this.assertAccessibleCompany(existing.company_id, accessibleCompanyIds)

    if (data.side && data.side !== existing.side) {
      const account = await this.repository.findCoaAccountById(existing.account_id)
      if (account) this.validateBalanceSide(account.account_type, account.normal_balance, data.side)
    }

    const purposeAccount = await this.repository.update(id, { ...data, updated_by: userId } as UpdateAccountingPurposeAccountDTO & { updated_by: string })
    if (!purposeAccount) throw AccountingPurposeAccountErrors.UPDATE_FAILED()

    await AuditService.log('UPDATE', 'accounting_purpose_account', id, userId, existing, purposeAccount)
    return purposeAccount
  }

  async delete(id: string, userId: string, accessibleCompanyIds: string[]): Promise<void> {
    const pa = await this.repository.findById(id)
    if (!pa) throw AccountingPurposeAccountErrors.NOT_FOUND(id)
    this.assertAccessibleCompany(pa.company_id, accessibleCompanyIds)

    await this.repository.delete(id, userId)
    await AuditService.log('DELETE', 'accounting_purpose_account', id, userId, pa, null)
    logInfo('Purpose account mapping deleted', { id })
  }

  async bulkCreate(data: BulkCreateAccountingPurposeAccountDTO, companyId: string, userId: string): Promise<AccountingPurposeAccount[]> {
    logInfo('Bulk creating purpose account mappings', { purpose_id: data.purpose_id, count: data.accounts.length })

    const purposeExists = await this.repository.purposeExists(data.purpose_id, companyId)
    if (!purposeExists) throw AccountingPurposeAccountErrors.PURPOSE_NOT_FOUND(data.purpose_id)

    for (const accountData of data.accounts) {
      const account = await this.repository.findCoaAccount(accountData.account_id, companyId)
      if (!account) throw AccountingPurposeAccountErrors.ACCOUNT_NOT_FOUND(accountData.account_id)
      if (!account.is_postable) throw AccountingPurposeAccountErrors.ACCOUNT_NOT_POSTABLE(account.account_code)
      this.validateBalanceSide(account.account_type, account.normal_balance, accountData.side)

      const existing = await this.repository.findByPurposeAndAccount(data.purpose_id, accountData.account_id, accountData.side)
      if (existing) throw AccountingPurposeAccountErrors.DUPLICATE_MAPPING(data.purpose_id, accountData.account_id, accountData.side)
    }

    const result = await this.repository.bulkCreate(data.purpose_id, data.accounts, companyId, userId)
    await AuditService.log('BULK_CREATE', 'accounting_purpose_account', data.purpose_id, userId, null, { count: result.length })
    return result
  }

  async bulkRemove(data: BulkRemoveAccountingPurposeAccountDTO, userId: string, accessibleCompanyIds: string[]): Promise<void> {
    logInfo('Bulk removing purpose account mappings', { purpose_id: data.purpose_id, count: data.account_ids.length })

    const purposeExists = await this.repository.purposeExistsInCompanies(data.purpose_id, accessibleCompanyIds)
    if (!purposeExists) throw AccountingPurposeAccountErrors.PURPOSE_NOT_FOUND(data.purpose_id)

    await this.repository.bulkRemove(data.purpose_id, data.account_ids, userId)
    await AuditService.log('BULK_REMOVE', 'accounting_purpose_account', data.purpose_id, userId, null, { count: data.account_ids.length })
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, userId: string, accessibleCompanyIds: string[]): Promise<void> {
    for (const id of ids) {
      const pa = await this.repository.findById(id)
      if (pa) this.assertAccessibleCompany(pa.company_id, accessibleCompanyIds)
    }

    await this.repository.bulkUpdateStatus(ids, isActive)
    await AuditService.log('BULK_UPDATE_STATUS', 'accounting_purpose_account', ids.join(','), userId, null, { is_active: isActive })
  }

  async exportToExcel(companyIds: string[], filter?: Record<string, unknown>): Promise<Buffer> {
    const data = await this.repository.exportData(companyIds, filter as Parameters<typeof this.repository.exportData>[1], AccountingPurposeAccountsConfig.EXPORT.MAX_ROWS)
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

  async listDeleted(companyIds: string[], pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: Record<string, unknown>): Promise<PaginatedResponse<AccountingPurposeAccountWithDetails>> {
    const { data, total } = await this.repository.findDeleted(companyIds, pagination, sort, filter as Parameters<typeof this.repository.findDeleted>[3])
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async restore(id: string, userId: string, accessibleCompanyIds: string[]): Promise<void> {
    const pa = await this.repository.findById(id)
    if (!pa) throw AccountingPurposeAccountErrors.NOT_FOUND(id)
    this.assertAccessibleCompany(pa.company_id, accessibleCompanyIds)
    if (!pa.deleted_at) throw new Error('This record has not been deleted and cannot be restored')

    await this.repository.restore(id, userId)
    await AuditService.log('RESTORE', 'accounting_purpose_account', id, userId, pa, null)
    logInfo('Purpose account mapping restored', { id })
  }

  private validateBalanceSide(accountType: string, normalBalance: string, side: string): void {
    const VALID_BALANCE_SIDES: Record<string, string[]> = {
      'ASSET': ['DEBIT'], 'LIABILITY': ['CREDIT'], 'EQUITY': ['CREDIT'], 'REVENUE': ['CREDIT'], 'EXPENSE': ['DEBIT']
    }
    const validSides = VALID_BALANCE_SIDES[accountType]
    if (!validSides) throw new Error(`Unknown account type: ${accountType}`)
    if (!validSides.includes(normalBalance)) {
      throw AccountingPurposeAccountErrors.INVALID_BALANCE_SIDE(accountType, normalBalance, side)
    }
    if ((normalBalance === 'DEBIT' && side === 'CREDIT') || (normalBalance === 'CREDIT' && side === 'DEBIT')) {
      logInfo('Contra account detected', { account_type: accountType, normal_balance: normalBalance, posting_side: side })
    }
  }
}

export const accountingPurposeAccountsService = new AccountingPurposeAccountsService()
