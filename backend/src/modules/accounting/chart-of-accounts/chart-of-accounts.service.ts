import { chartOfAccountsRepository, ChartOfAccountsRepository } from './chart-of-accounts.repository'
import { ChartOfAccount, CreateChartOfAccountDTO, UpdateChartOfAccountDTO, ChartOfAccountTreeNode } from './chart-of-accounts.types'
import type { CoaFilter } from './chart-of-accounts.repository'
import { PaginatedResponse, createPaginatedResponse } from '../../../utils/pagination.util'
import { ExportService } from '../../../services/export.service'
import { ImportService } from '../../../services/import.service'
import { AuditService } from '../../monitoring/monitoring.service'
import { ChartOfAccountErrors } from './chart-of-accounts.errors'
import { ChartOfAccountConfig } from './chart-of-accounts.constants'
import { logInfo, logError } from '../../../config/logger'

export class ChartOfAccountsService {
  constructor(private repository: ChartOfAccountsRepository = chartOfAccountsRepository) {}

  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: CoaFilter
  ): Promise<PaginatedResponse<ChartOfAccount>> {
    const { data, total } = await this.repository.findAll(companyId, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async search(
    companyId: string,
    searchTerm: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: CoaFilter
  ): Promise<PaginatedResponse<ChartOfAccount>> {
    const { data, total } = await this.repository.search(companyId, searchTerm, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async getTree(companyId: string, maxDepth?: number, filter?: CoaFilter): Promise<ChartOfAccountTreeNode[]> {
    logInfo('Getting chart of accounts tree', { company_id: companyId, max_depth: maxDepth })
    return await this.repository.findTree(companyId, maxDepth, filter)
  }

  async create(data: CreateChartOfAccountDTO, userId: string): Promise<ChartOfAccount> {
    logInfo('Creating chart of account', {
      account_code: data.account_code,
      company_id: data.company_id,
      parent_account_id: data.parent_account_id,
      user: userId
    })

    try {
      const existingAccount = await this.repository.findByCode(data.company_id, data.account_code)
      if (existingAccount) throw ChartOfAccountErrors.CODE_EXISTS(data.account_code)

      if (data.parent_account_id) {
        const parentAccount = await this.repository.findById(data.parent_account_id)
        if (!parentAccount) throw ChartOfAccountErrors.INVALID_PARENT(data.parent_account_id, 'Parent account not found')
        if (parentAccount.company_id !== data.company_id) throw ChartOfAccountErrors.PARENT_COMPANY_MISMATCH(parentAccount.company_id, data.company_id)
        if (!parentAccount.is_header) throw ChartOfAccountErrors.PARENT_MUST_BE_HEADER(parentAccount.account_code)
        if (parentAccount.account_type !== data.account_type) throw ChartOfAccountErrors.PARENT_TYPE_MISMATCH(parentAccount.account_type, data.account_type)
        if (parentAccount.level >= ChartOfAccountConfig.VALIDATION.MAX_HIERARCHY_LEVEL) {
          throw ChartOfAccountErrors.MAX_HIERARCHY_LEVEL_EXCEEDED(ChartOfAccountConfig.VALIDATION.MAX_HIERARCHY_LEVEL)
        }
      }

      if (data.is_header && data.is_postable) throw ChartOfAccountErrors.HEADER_CANNOT_BE_POSTABLE()

      const debitAccounts = ChartOfAccountConfig.DEBIT_ACCOUNTS
      const creditAccounts = ChartOfAccountConfig.CREDIT_ACCOUNTS
      if (debitAccounts.includes(data.account_type) && data.normal_balance !== 'DEBIT') {
        throw ChartOfAccountErrors.INVALID_NORMAL_BALANCE(data.account_type, data.normal_balance, 'DEBIT')
      }
      if (creditAccounts.includes(data.account_type) && data.normal_balance !== 'CREDIT') {
        throw ChartOfAccountErrors.INVALID_NORMAL_BALANCE(data.account_type, data.normal_balance, 'CREDIT')
      }

      const trimmedData: CreateChartOfAccountDTO = {
        ...data,
        account_code: data.account_code.trim().toUpperCase(),
        account_name: data.account_name.trim(),
        currency_code: data.currency_code || ChartOfAccountConfig.DEFAULT_CURRENCY,
        is_header: data.is_header || false,
        is_postable: data.is_postable !== undefined ? data.is_postable : true
      }

      const account = await this.repository.create(trimmedData, userId)
      if (!account) throw ChartOfAccountErrors.CREATE_FAILED()

      await AuditService.log('CREATE', 'chart_of_account', account.id, userId, null, account)
      logInfo('Chart of account created successfully', { account_id: account.id })
      return account
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; constraint?: string }
      if (err.code === '23505' && (err.message?.includes('account_code') || err.constraint?.includes('account_code'))) {
        throw ChartOfAccountErrors.CODE_EXISTS(data.account_code)
      }
      logError('Failed to create chart of account', { error: err.message, account_code: data.account_code, user: userId })
      throw error
    }
  }

  async getById(id: string, companyId?: string): Promise<ChartOfAccount> {
    const account = await this.repository.findById(id)
    if (!account) throw ChartOfAccountErrors.NOT_FOUND(id)
    if (companyId && account.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)
    return account
  }

  async update(id: string, data: UpdateChartOfAccountDTO, userId: string, companyId?: string): Promise<ChartOfAccount> {
    logInfo('Updating chart of account', { account_id: id, user: userId })

    const existing = await this.repository.findById(id)
    if (!existing) throw ChartOfAccountErrors.NOT_FOUND(id)
    if (companyId && existing.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)

    try {
      if (data.parent_account_id !== undefined) {
        if (data.parent_account_id) {
          const parentAccount = await this.repository.findById(data.parent_account_id)
          if (!parentAccount) throw ChartOfAccountErrors.INVALID_PARENT(data.parent_account_id, 'Parent account not found')
          if (parentAccount.id === id) throw ChartOfAccountErrors.INVALID_PARENT(data.parent_account_id, 'Cannot set self as parent')
          if (parentAccount.company_id !== existing.company_id) throw ChartOfAccountErrors.PARENT_COMPANY_MISMATCH(parentAccount.company_id, existing.company_id)
          if (!parentAccount.is_header) throw ChartOfAccountErrors.PARENT_MUST_BE_HEADER(parentAccount.account_code)
          if (parentAccount.account_type !== existing.account_type) throw ChartOfAccountErrors.PARENT_TYPE_MISMATCH(parentAccount.account_type, existing.account_type)
          if (parentAccount.level >= ChartOfAccountConfig.VALIDATION.MAX_HIERARCHY_LEVEL) {
            throw ChartOfAccountErrors.MAX_HIERARCHY_LEVEL_EXCEEDED(ChartOfAccountConfig.VALIDATION.MAX_HIERARCHY_LEVEL)
          }
          const hasCircularRef = await this.repository.checkCircularReference(id, data.parent_account_id)
          if (hasCircularRef) throw ChartOfAccountErrors.INVALID_PARENT(data.parent_account_id, 'Circular reference detected')
        }
      }

      const isHeader = data.is_header !== undefined ? data.is_header : existing.is_header
      const isPostable = data.is_postable !== undefined ? data.is_postable : existing.is_postable
      if (isHeader && isPostable) throw ChartOfAccountErrors.HEADER_CANNOT_BE_POSTABLE()

      const trimmedData = {
        ...data,
        ...(data.account_name && { account_name: data.account_name.trim() }),
        updated_by: userId
      }

      const account = await this.repository.update(id, trimmedData)
      if (!account) throw ChartOfAccountErrors.UPDATE_FAILED()

      await AuditService.log('UPDATE', 'chart_of_account', id, userId, existing, account)
      logInfo('Chart of account updated successfully', { account_id: id })
      return account
    } catch (error: unknown) {
      logError('Failed to update chart of account', { error: (error as Error).message, account_id: id })
      throw error
    }
  }

  async delete(id: string, userId: string, companyId?: string): Promise<void> {
    logInfo('Deleting chart of account', { account_id: id, user: userId })

    const account = await this.repository.findById(id)
    if (!account) throw ChartOfAccountErrors.NOT_FOUND(id)
    if (companyId && account.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)

    const hasChildren = await this.repository.hasChildren(id)
    if (hasChildren) throw ChartOfAccountErrors.CANNOT_DELETE_WITH_CHILDREN()

    await this.repository.delete(id, userId)
    await AuditService.log('DELETE', 'chart_of_account', id, userId, account, null)
    logInfo('Chart of account deleted successfully', { account_id: id })
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk updating chart of account status', { count: ids.length, is_active: isActive, user: userId })
    this.validateUUIDs(ids)

    if (companyId) {
      for (const id of ids) {
        const account = await this.repository.findById(id)
        if (account && account.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)
      }
    }

    await this.repository.bulkUpdateStatus(ids, isActive)
    await AuditService.log('BULK_UPDATE_STATUS', 'chart_of_account', ids.join(','), userId, null, { is_active: isActive })
    logInfo('Bulk status update completed', { count: ids.length })
  }

  async bulkDelete(ids: string[], userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk deleting chart of accounts', { count: ids.length, user: userId })
    this.validateUUIDs(ids)

    if (companyId) {
      for (const id of ids) {
        const account = await this.repository.findById(id)
        if (account && account.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)
      }
    }

    await this.repository.bulkDelete(ids, userId)
    await AuditService.log('BULK_DELETE', 'chart_of_account', ids.join(','), userId, null, null)
    logInfo('Bulk delete completed', { count: ids.length })
  }

  async restore(id: string, userId: string, companyId?: string): Promise<void> {
    logInfo('Restoring chart of account', { account_id: id, user: userId })

    const account = await this.repository.findById(id)
    if (!account) throw ChartOfAccountErrors.NOT_FOUND(id)
    if (companyId && account.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)

    await this.repository.restore(id, userId)
    await AuditService.log('RESTORE', 'chart_of_account', id, userId, null, account)
    logInfo('Chart of account restored successfully', { account_id: id })
  }

  async bulkRestore(ids: string[], userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk restoring chart of accounts', { count: ids.length, user: userId })
    this.validateUUIDs(ids)

    if (companyId) {
      for (const id of ids) {
        const account = await this.repository.findById(id)
        if (account && account.company_id !== companyId) throw ChartOfAccountErrors.COMPANY_ACCESS_DENIED(companyId)
      }
    }

    await this.repository.bulkRestore(ids, userId)
    await AuditService.log('BULK_RESTORE', 'chart_of_account', ids.join(','), userId, null, null)
    logInfo('Bulk restore completed', { count: ids.length })
  }

  async getFilterOptions(companyId: string) {
    return await this.repository.getFilterOptions(companyId)
  }

  async exportToExcel(companyId: string, filter?: Record<string, unknown>): Promise<Buffer> {
    logInfo('Exporting chart of accounts to Excel', { company_id: companyId })
    const data = await this.repository.exportData(companyId, filter, ChartOfAccountConfig.EXPORT.MAX_ROWS)
    const columns = [
      { header: 'Account Code', key: 'account_code', width: 15 },
      { header: 'Account Name', key: 'account_name', width: 30 },
      { header: 'Account Type', key: 'account_type', width: 15 },
      { header: 'Account Subtype', key: 'account_subtype', width: 20 },
      { header: 'Normal Balance', key: 'normal_balance', width: 15 },
      { header: 'Is Header', key: 'is_header', width: 10 },
      { header: 'Is Postable', key: 'is_postable', width: 10 },
      { header: 'Currency', key: 'currency_code', width: 10 },
      { header: 'Level', key: 'level', width: 10 },
      { header: 'Path', key: 'account_path', width: 40 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ]
    return await ExportService.generateExcel(data, columns)
  }

  async previewImport(buffer: Buffer): Promise<unknown[]> {
    return await ImportService.parseExcel(buffer)
  }

  async importFromExcel(buffer: Buffer, skipDuplicates: boolean, companyId: string, userId: string): Promise<unknown> {
    logInfo('Importing chart of accounts from Excel', { company_id: companyId, skipDuplicates })
    const rows = await ImportService.parseExcel(buffer)
    const requiredFields = ['account_code', 'account_name', 'account_type', 'normal_balance']

    return await ImportService.processImport(
      rows,
      requiredFields,
      async (row: Record<string, unknown>) => {
        if (skipDuplicates) {
          const existingAccount = await this.repository.findByCode(companyId, row.account_code as string)
          if (existingAccount) throw ChartOfAccountErrors.CODE_EXISTS(row.account_code as string)
        }

        const debitAccounts = ChartOfAccountConfig.DEBIT_ACCOUNTS
        const creditAccounts = ChartOfAccountConfig.CREDIT_ACCOUNTS
        if (debitAccounts.includes(row.account_type as string) && row.normal_balance !== 'DEBIT') {
          throw ChartOfAccountErrors.INVALID_NORMAL_BALANCE(row.account_type as string, row.normal_balance as string, 'DEBIT')
        }
        if (creditAccounts.includes(row.account_type as string) && row.normal_balance !== 'CREDIT') {
          throw ChartOfAccountErrors.INVALID_NORMAL_BALANCE(row.account_type as string, row.normal_balance as string, 'CREDIT')
        }

        await this.repository.create({
          company_id: companyId,
          account_code: (row.account_code as string).trim().toUpperCase(),
          account_name: (row.account_name as string).trim(),
          account_type: row.account_type as CreateChartOfAccountDTO['account_type'],
          account_subtype: (row.account_subtype as string) || null,
          normal_balance: row.normal_balance as CreateChartOfAccountDTO['normal_balance'],
          currency_code: (row.currency_code as string) || ChartOfAccountConfig.DEFAULT_CURRENCY,
          is_header: row.is_header === 'true' || row.is_header === true,
          is_postable: row.is_postable !== 'false' && row.is_postable !== false
        }, userId)
      },
      skipDuplicates
    )
  }

  private validateUUIDs(ids: string[]): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => !uuidRegex.test(id))
    if (invalidIds.length > 0) throw ChartOfAccountErrors.INVALID_PARENT(invalidIds.join(', '), 'Invalid UUID format')
  }
}

export const chartOfAccountsService = new ChartOfAccountsService()