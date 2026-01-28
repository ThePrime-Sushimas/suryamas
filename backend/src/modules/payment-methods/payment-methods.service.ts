import { paymentMethodsRepository, PaymentMethodsRepository } from './payment-methods.repository'
import { 
  PaymentMethod, 
  CreatePaymentMethodDto, 
  UpdatePaymentMethodDto,
  PaymentMethodWithDetails,
  PaymentMethodFilterParams
} from './payment-methods.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { ExportService } from '../../services/export.service'
import { AuditService } from '../../services/audit.service'
import { PaymentMethodErrors } from './payment-methods.errors'
import { PaymentMethodsConfig } from './payment-methods.errors'
import { logInfo, logError, logWarn } from '../../config/logger'
import { supabase } from '../../config/supabase'

// Fee calculation service untuk validasi
import { feeCalculationService, FeeConfig } from '../reconciliation/fee-reconciliation/fee-calculation.service'

/**
 * Transaction context interface for database operations
 */
interface TransactionContext {
  client: typeof supabase
}

export class PaymentMethodsService {
  constructor(private repository: PaymentMethodsRepository = paymentMethodsRepository) {}

  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: PaymentMethodFilterParams
  ): Promise<PaginatedResponse<PaymentMethodWithDetails>> {
    const { data, total } = await this.repository.findAll(companyId, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async getById(id: number, companyId?: string): Promise<PaymentMethodWithDetails> {
    const paymentMethod = await this.repository.findById(id)
    if (!paymentMethod) {
      throw PaymentMethodErrors.NOT_FOUND(id)
    }
    
    if (companyId && paymentMethod.company_id !== companyId) {
      throw PaymentMethodErrors.COMPANY_ACCESS_DENIED(companyId)
    }
    
    return paymentMethod
  }

  async create(data: CreatePaymentMethodDto, userId: string): Promise<PaymentMethod> {
    logInfo('Creating payment method', { 
      code: data.code,
      name: data.name,
      payment_type: data.payment_type,
      company_id: data.company_id
    })
    
    return await this.repository.withTransaction(async (trx) => {
      try {
        // Validate company exists
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('id')
          .eq('id', data.company_id)
          .maybeSingle()

        if (companyError) throw new Error(companyError.message)
        if (!company) {
          throw PaymentMethodErrors.COMPANY_NOT_FOUND(data.company_id)
        }

        // Check for duplicate code
        const existing = await this.repository.findByCode(data.company_id, data.code, trx)
        if (existing) {
          throw PaymentMethodErrors.CODE_EXISTS(data.code, data.company_id)
        }

        // Validate bank account if provided
        if (data.bank_account_id) {
          const bankAccount = await this.validateBankAccount(data.bank_account_id, data.company_id, trx)
          if (!bankAccount.is_active) {
            throw PaymentMethodErrors.BANK_ACCOUNT_INACTIVE(data.bank_account_id)
          }
        }

        // Validate COA if provided
        if (data.coa_account_id) {
          await this.validateCoaAccount(data.coa_account_id, data.company_id, trx)
        }

        // === 🔥 VALIDATE FEE CONFIGURATION ===
        this.validateFeeConfig({
          fee_percentage: data.fee_percentage,
          fee_fixed_amount: data.fee_fixed_amount,
          fee_fixed_per_transaction: data.fee_fixed_per_transaction
        })

        // Handle default payment method
        if (data.is_default) {
          await this.repository.unsetDefault(data.company_id, undefined, trx)
        }

        const paymentMethod = await this.repository.create(data, userId, trx)

        if (!paymentMethod) {
          throw PaymentMethodErrors.CREATE_FAILED()
        }

        await AuditService.log('CREATE', 'payment_methods', paymentMethod.id.toString(), userId, null, paymentMethod)
        logInfo('Payment method created successfully', { id: paymentMethod.id, code: paymentMethod.code })
        return paymentMethod
      } catch (error: any) {
        logError('Failed to create payment method', { 
          error: error.message, 
          code: data.code,
          company_id: data.company_id
        })
        throw error
      }
    })
  }

  async update(id: number, data: UpdatePaymentMethodDto, userId: string, companyId?: string): Promise<PaymentMethod> {
    logInfo('Updating payment method', { id, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      const existing = await this.repository.findById(id, trx)
      if (!existing) {
        throw PaymentMethodErrors.NOT_FOUND(id)
      }

      if (companyId && existing.company_id !== companyId) {
        throw PaymentMethodErrors.COMPANY_ACCESS_DENIED(companyId)
      }

      try {
        // Check for duplicate code if code is being changed
        if (data.code) {
          const existingCode = await this.repository.findByCodeExcludeId(
            existing.company_id, 
            data.code, 
            id, 
            trx
          )
          if (existingCode) {
            throw PaymentMethodErrors.CODE_EXISTS(data.code, existing.company_id)
          }
        }

        // Validate bank account if provided
        if (data.bank_account_id) {
          const bankAccount = await this.validateBankAccount(data.bank_account_id, existing.company_id, trx)
          if (!bankAccount.is_active) {
            throw PaymentMethodErrors.BANK_ACCOUNT_INACTIVE(data.bank_account_id)
          }
        }

        // Validate COA if provided
        if (data.coa_account_id) {
          await this.validateCoaAccount(data.coa_account_id, existing.company_id, trx)
        }

        // === 🔥 VALIDATE FEE CONFIGURATION ===
        this.validateFeeConfig({
          fee_percentage: data.fee_percentage,
          fee_fixed_amount: data.fee_fixed_amount,
          fee_fixed_per_transaction: data.fee_fixed_per_transaction
        })

        // Handle default payment method
        if (data.is_default && !existing.is_default) {
          await this.repository.unsetDefault(existing.company_id, id, trx)
        }

        // Prevent deactivating default payment method
        if (data.is_active === false && existing.is_default) {
          throw PaymentMethodErrors.CANNOT_DEACTIVATE_DEFAULT(id)
        }

        // Prevent deleting (setting as non-default) default payment method
        if (data.is_default === false && existing.is_default) {
          throw PaymentMethodErrors.CANNOT_DELETE_DEFAULT(id)
        }

        const paymentMethod = await this.repository.updateWithUser(id, data, userId, trx)
        if (!paymentMethod) {
          throw PaymentMethodErrors.UPDATE_FAILED()
        }

        await AuditService.log('UPDATE', 'payment_methods', id.toString(), userId, existing, paymentMethod)
        logInfo('Payment method updated successfully', { id })
        return paymentMethod
      } catch (error: any) {
        logError('Failed to update payment method', { error: error.message, id })
        throw error
      }
    })
  }

  async delete(id: number, userId: string, companyId?: string): Promise<void> {
    logInfo('Deleting payment method', { id, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      const paymentMethod = await this.repository.findById(id, trx)
      if (!paymentMethod) {
        throw PaymentMethodErrors.NOT_FOUND(id)
      }

      if (companyId && paymentMethod.company_id !== companyId) {
        throw PaymentMethodErrors.COMPANY_ACCESS_DENIED(companyId)
      }

      // Prevent deleting default payment method
      if (paymentMethod.is_default) {
        throw PaymentMethodErrors.CANNOT_DELETE_DEFAULT(id)
      }

      await this.repository.softDelete(id, userId, trx)
      await AuditService.log('DELETE', 'payment_methods', id.toString(), userId, paymentMethod, null)
      logInfo('Payment method deleted successfully', { id })
    })
  }

  async bulkUpdateStatus(ids: number[], isActive: boolean, userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk updating payment method status', { count: ids.length, is_active: isActive, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      // Validate all records belong to the company
      for (const id of ids) {
        const paymentMethod = await this.repository.findById(id, trx)
        if (!paymentMethod) {
          throw PaymentMethodErrors.NOT_FOUND(id)
        }

        if (companyId && paymentMethod.company_id !== companyId) {
          throw PaymentMethodErrors.COMPANY_ACCESS_DENIED(companyId)
        }

        // Prevent deactivating default payment method
        if (!isActive && paymentMethod.is_default) {
          throw PaymentMethodErrors.CANNOT_DEACTIVATE_DEFAULT(id)
        }
      }

      await this.repository.bulkUpdateStatus(ids, isActive, userId, trx)
      await AuditService.log('BULK_UPDATE_STATUS', 'payment_methods', ids.join(','), userId, null, { is_active: isActive })
      logInfo('Bulk status update completed', { count: ids.length })
    })
  }

  async bulkDelete(ids: number[], userId: string, companyId?: string): Promise<void> {
    logInfo('Bulk deleting payment methods', { count: ids.length, user: userId })
    
    return await this.repository.withTransaction(async (trx) => {
      // Validate all records
      for (const id of ids) {
        const paymentMethod = await this.repository.findById(id, trx)
        if (!paymentMethod) {
          throw PaymentMethodErrors.NOT_FOUND(id)
        }

        if (companyId && paymentMethod.company_id !== companyId) {
          throw PaymentMethodErrors.COMPANY_ACCESS_DENIED(companyId)
        }

        // Prevent deleting default payment method
        if (paymentMethod.is_default) {
          throw PaymentMethodErrors.CANNOT_DELETE_DEFAULT(id)
        }
      }

      await this.repository.bulkDelete(ids, userId, trx)
      await AuditService.log('BULK_DELETE', 'payment_methods', ids.join(','), userId, null, { count: ids.length })
      logInfo('Bulk delete completed', { count: ids.length })
    })
  }

  async exportToExcel(companyId: string, filter?: PaymentMethodFilterParams): Promise<Buffer> {
    logInfo('Exporting payment methods to Excel', { company_id: companyId, filter })
    const data = await this.repository.exportData(companyId, filter, PaymentMethodsConfig.EXPORT.MAX_ROWS)
    const columns = [
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Payment Type', key: 'payment_type', width: 20 },
      { header: 'Bank', key: 'bank_name', width: 20 },
      { header: 'Account Number', key: 'account_number', width: 20 },
      { header: 'COA Code', key: 'coa_code', width: 15 },
      { header: 'COA Name', key: 'coa_name', width: 30 },
      { header: 'Default', key: 'is_default', width: 10 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Sort Order', key: 'sort_order', width: 10 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ]
    return await ExportService.generateExcel(data, columns)
  }

  async getOptions(companyId: string): Promise<PaymentMethodWithDetails[]> {
    return this.repository.getOptions(companyId)
  }

  async getByBankAccountId(bankAccountId: number): Promise<PaymentMethod | null> {
    return this.repository.findByBankAccountId(bankAccountId)
  }

  private async validateBankAccount(bankAccountId: number, companyId: string, trx?: TransactionContext): Promise<{
    id: number
    is_active: boolean
    owner_type: string
    owner_id: string
  }> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('bank_accounts')
      .select('id, is_active, owner_type, owner_id')
      .eq('id', bankAccountId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) {
      throw PaymentMethodErrors.BANK_ACCOUNT_NOT_FOUND(bankAccountId)
    }

    return data as { id: number; is_active: boolean; owner_type: string; owner_id: string }
  }

  private async validateCoaAccount(coaAccountId: string, companyId: string, trx?: TransactionContext): Promise<{
    id: string
    account_code: string
    account_type: string
    is_postable: boolean
    company_id: string
  }> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('chart_of_accounts')
      .select('id, account_code, account_type, is_postable, company_id')
      .eq('id', coaAccountId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) {
      throw PaymentMethodErrors.COA_ACCOUNT_NOT_FOUND(coaAccountId)
    }

    if (data.company_id !== companyId) {
      throw PaymentMethodErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    if (!data.is_postable) {
      throw PaymentMethodErrors.COA_NOT_POSTABLE(data.account_code)
    }

    return data as { id: string; account_code: string; account_type: string; is_postable: boolean; company_id: string }
  }

  /**
   * Validate fee configuration
   * Memastikan fee configuration valid sebelum disimpan
   */
  private validateFeeConfig(feeConfig: {
    fee_percentage?: number
    fee_fixed_amount?: number
    fee_fixed_per_transaction?: boolean
  }): void {
    const errors: string[] = []

    // Validate fee_percentage
    if (feeConfig.fee_percentage !== undefined && feeConfig.fee_percentage < 0) {
      errors.push('fee_percentage tidak boleh negatif')
    }
    if (feeConfig.fee_percentage !== undefined && feeConfig.fee_percentage > 100) {
      errors.push('fee_percentage tidak boleh lebih dari 100%')
    }

    // Validate fee_fixed_amount
    if (feeConfig.fee_fixed_amount !== undefined && feeConfig.fee_fixed_amount < 0) {
      errors.push('fee_fixed_amount tidak boleh negatif')
    }

    // Warning jika fee > 99% dari gross (akan menghasilkan negative net)
    if (feeConfig.fee_percentage !== undefined && feeConfig.fee_percentage > 99) {
      logWarn('validateFeeConfig: fee_percentage > 99%, kemungkinan menghasilkan negative net')
    }

    if (errors.length > 0) {
      throw new Error(`Invalid fee configuration: ${errors.join(', ')}`)
    }
  }

  /**
   * Format fee untuk display
   */
  formatFee(feeConfig: {
    fee_percentage?: number
    fee_fixed_amount?: number
    fee_fixed_per_transaction?: boolean
  }): string {
    const parts: string[] = []
    const percentage = feeConfig.fee_percentage || 0
    const fixed = feeConfig.fee_fixed_amount || 0
    const perTx = feeConfig.fee_fixed_per_transaction || false

    if (percentage > 0) {
      parts.push(`${percentage}%`)
    }

    if (fixed > 0) {
      const fixedLabel = perTx 
        ? `Rp ${fixed.toLocaleString()}/tx`
        : `Rp ${fixed.toLocaleString()}`
      parts.push(fixedLabel)
    }

    return parts.length > 0 ? parts.join(' + ') : 'Gratis'
  }
}

export const paymentMethodsService = new PaymentMethodsService()

