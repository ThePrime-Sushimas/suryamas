import { supabase } from '../../config/supabase'
import { 
  PaymentMethod, 
  CreatePaymentMethodDto, 
  UpdatePaymentMethodDto,
  PaymentMethodWithDetails,
  PaymentMethodFilterParams
} from './payment-methods.types'
import { logError, logInfo } from '../../config/logger'

/**
 * Transaction context interface for database operations
 */
interface TransactionContext {
  client: typeof supabase
}

/**
 * Filter parameters for repository queries
 */
interface FilterParams {
  payment_type?: string
  is_active?: boolean
  requires_bank_account?: boolean
  search?: string
}

export class PaymentMethodsRepository {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private getCacheKey(prefix: string, ...args: string[]): string {
    return `${prefix}:${args.join(':')}`
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T
    }
    this.cache.delete(key)
    return null
  }

  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  private invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  async withTransaction<T>(callback: (trx: TransactionContext) => Promise<T>): Promise<T> {
    try {
      const result = await callback({ client: supabase })
      return result
    } catch (error) {
      logError('Transaction failed', { error: (error as Error).message })
      throw error
    }
  }

  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: FilterParams,
    trx?: TransactionContext
  ): Promise<{ data: PaymentMethodWithDetails[]; total: number }> {
    const client = trx?.client || supabase
    
    let query = client
      .from('payment_methods')
      .select(`
        *,
        bank_accounts(id, bank_id, account_name, account_number,
          banks(id, bank_code, bank_name)
        ),
        chart_of_accounts(id, account_code, account_name, account_type)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
    
    let countQuery = client
      .from('payment_methods')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null)
    
    if (filter) {
      if (filter.payment_type) {
        query = query.eq('payment_type', filter.payment_type)
        countQuery = countQuery.eq('payment_type', filter.payment_type)
      }
      if (filter.is_active !== undefined) {
        query = query.eq('is_active', filter.is_active)
        countQuery = countQuery.eq('is_active', filter.is_active)
      }
      if (filter.requires_bank_account !== undefined) {
        query = query.eq('requires_bank_account', filter.requires_bank_account)
        countQuery = countQuery.eq('requires_bank_account', filter.requires_bank_account)
      }
      if (filter.search) {
        const searchPattern = `%${filter.search}%`
        query = query.or(`code.ilike.${searchPattern},name.ilike.${searchPattern}`)
        countQuery = countQuery.or(`code.ilike.${searchPattern},name.ilike.${searchPattern}`)
      }
    }
    
    if (sort) {
      const validFields = ['sort_order', 'code', 'name', 'payment_type', 'is_active', 'created_at']
      if (validFields.includes(sort.field)) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      }
    } else {
      query = query.order('sort_order', { ascending: true }).order('code', { ascending: true })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    const mappedData = (data || []).map((item: any) => {
      const bankAccount = Array.isArray(item.bank_accounts) ? item.bank_accounts[0] : item.bank_accounts
      const bank = bankAccount ? (Array.isArray(bankAccount.banks) ? bankAccount.banks[0] : bankAccount.banks) : null
      const coa = Array.isArray(item.chart_of_accounts) ? item.chart_of_accounts[0] : item.chart_of_accounts
      
      return {
        ...item,
        bank_code: bank?.bank_code,
        bank_name: bank?.bank_name,
        account_number: bankAccount?.account_number,
        account_name: bankAccount?.account_name,
        coa_code: coa?.account_code,
        coa_name: coa?.account_name,
        coa_type: coa?.account_type,
        bank_accounts: undefined,
        chart_of_accounts: undefined,
      }
    })
    
    return { data: mappedData, total: count || 0 }
  }

  async findById(id: number, trx?: TransactionContext): Promise<PaymentMethodWithDetails | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('payment_methods')
      .select(`
        *,
        bank_accounts(id, bank_id, account_name, account_number,
          banks(id, bank_code, bank_name)
        ),
        chart_of_accounts(id, account_code, account_name, account_type)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    
    if (!data) return null

    const bankAccount = Array.isArray(data.bank_accounts) ? data.bank_accounts[0] : data.bank_accounts
    const bank = bankAccount ? (Array.isArray(bankAccount.banks) ? bankAccount.banks[0] : bankAccount.banks) : null
    const coa = Array.isArray(data.chart_of_accounts) ? data.chart_of_accounts[0] : data.chart_of_accounts
    
    return {
      ...data,
      bank_code: bank?.bank_code,
      bank_name: bank?.bank_name,
      account_number: bankAccount?.account_number,
      account_name: bankAccount?.account_name,
      coa_code: coa?.account_code,
      coa_name: coa?.account_name,
      coa_type: coa?.account_type,
      bank_accounts: undefined,
      chart_of_accounts: undefined,
    }
  }

  async findByCode(companyId: string, code: string, trx?: TransactionContext): Promise<PaymentMethod | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('payment_methods')
      .select('*')
      .eq('company_id', companyId)
      .eq('code', code.toUpperCase())
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByCodeExcludeId(companyId: string, code: string, excludeId: number, trx?: TransactionContext): Promise<PaymentMethod | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('payment_methods')
      .select('*')
      .eq('company_id', companyId)
      .eq('code', code.toUpperCase())
      .neq('id', excludeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findDefault(companyId: string, trx?: TransactionContext): Promise<PaymentMethod | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('payment_methods')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByBankAccountId(bankAccountId: number, trx?: TransactionContext): Promise<PaymentMethod | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('payment_methods')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async create(data: CreatePaymentMethodDto, userId: string, trx?: TransactionContext): Promise<PaymentMethod> {
    const client = trx?.client || supabase
    
    const { data: result, error } = await client
      .from('payment_methods')
      .insert({
        ...data,
        code: data.code.toUpperCase(),
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logError('Repository create error', { error: error.message, code: error.code })
      throw error
    }
    
    logInfo('Payment method created in repository', {
      id: result.id,
      code: result.code,
      company_id: result.company_id,
      user_id: userId
    })
    
    this.invalidateCache(data.company_id)
    return result
  }

  async update(id: number, updates: UpdatePaymentMethodDto, trx?: TransactionContext): Promise<PaymentMethod | null> {
    const client = trx?.client || supabase
    
    // Get current record to know company_id for cache invalidation
    const existing = await this.findById(id, trx)
    if (!existing) return null

    const { data, error } = await client
      .from('payment_methods')
      .update({ 
        ...updates, 
        updated_at: new Date().toISOString(),
        updated_by: existing.company_id // Will be replaced by actual user in service
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logError('Repository update error', { error: error.message, code: error.code })
      throw error
    }
    
    if (data) {
      this.invalidateCache(data.company_id)
    }
    return data
  }

  async updateWithUser(id: number, updates: UpdatePaymentMethodDto, userId: string, trx?: TransactionContext): Promise<PaymentMethod | null> {
    const client = trx?.client || supabase
    
    // Get current record to know company_id for cache invalidation
    const existing = await this.findById(id, trx)
    if (!existing) return null

    const { data, error } = await client
      .from('payment_methods')
      .update({ 
        ...updates, 
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logError('Repository update error', { error: error.message, code: error.code })
      throw error
    }
    
    if (data) {
      this.invalidateCache(data.company_id)
    }
    return data
  }

  async softDelete(id: number, userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    
    // Get current record to know company_id for cache invalidation
    const existing = await this.findById(id, trx)
    if (!existing) throw new Error('Payment method not found')

    const { error } = await client
      .from('payment_methods')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        is_active: false,
        is_default: false
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
    this.invalidateCache(existing.company_id)
  }

  async unsetDefault(companyId: string, excludeId?: number, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    
    let query = client
      .from('payment_methods')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('is_default', true)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { error } = await query
    if (error) throw new Error(error.message)
    this.invalidateCache(companyId)
  }

  async bulkUpdateStatus(ids: number[], isActive: boolean, userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('payment_methods')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .in('id', ids)

    if (error) throw new Error(error.message)
    
    // Invalidate cache for all affected records
    for (const id of ids) {
      const record = await this.findById(id, trx)
      if (record) {
        this.invalidateCache(record.company_id)
      }
    }
  }

  async bulkDelete(ids: number[], userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    
    // Get all records to know company_ids for cache invalidation
    const records = await Promise.all(
      ids.map(id => this.findById(id, trx))
    )
    const companyIds = [...new Set(records.filter(Boolean).map(r => r!.company_id))]

    const { error } = await client
      .from('payment_methods')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        is_active: false,
        is_default: false
      })
      .in('id', ids)

    if (error) throw new Error(error.message)
    
    for (const companyId of companyIds) {
      this.invalidateCache(companyId)
    }
  }

  async exportData(companyId: string, filter?: FilterParams, limit: number = 10000): Promise<PaymentMethodWithDetails[]> {
    let query = supabase
      .from('payment_methods')
      .select(`
        *,
        bank_accounts(id, account_number, account_name,
          banks(id, bank_code, bank_name)
        ),
        chart_of_accounts(id, account_code, account_name)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .limit(limit)
    
    if (filter) {
      if (filter.payment_type) query = query.eq('payment_type', filter.payment_type)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
    }
    
    const { data, error } = await query.order('sort_order', { ascending: true }).order('code', { ascending: true })
    if (error) {
      logError('Repository export error', { error: error.message })
      throw new Error(error.message)
    }
    
    return (data || []).map((item: any) => {
      const bankAccount = Array.isArray(item.bank_accounts) ? item.bank_accounts[0] : item.bank_accounts
      const bank = bankAccount ? (Array.isArray(bankAccount.banks) ? bankAccount.banks[0] : bankAccount.banks) : null
      const coa = Array.isArray(item.chart_of_accounts) ? item.chart_of_accounts[0] : item.chart_of_accounts
      
      return {
        ...item,
        bank_code: bank?.bank_code,
        bank_name: bank?.bank_name,
        account_number: bankAccount?.account_number,
        account_name: bankAccount?.account_name,
        coa_code: coa?.account_code,
        coa_name: coa?.account_name,
        bank_accounts: undefined,
        chart_of_accounts: undefined,
      }
    })
  }

  async getOptions(companyId: string, trx?: TransactionContext): Promise<PaymentMethodWithDetails[]> {
    const client = trx?.client || supabase
    
    const { data, error } = await client
      .from('payment_methods')
      .select(`
        id, code, name, payment_type, bank_account_id,
        bank_accounts(id, account_number,
          banks(id, bank_code, bank_name)
        ),
        chart_of_accounts(id, account_code, account_name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true })

    if (error) throw new Error(error.message)
    
    return (data || []).map((item: any) => {
      const bankAccount = Array.isArray(item.bank_accounts) ? item.bank_accounts[0] : item.bank_accounts
      const bank = bankAccount ? (Array.isArray(bankAccount.banks) ? bankAccount.banks[0] : bankAccount.banks) : null
      const coa = Array.isArray(item.chart_of_accounts) ? item.chart_of_accounts[0] : item.chart_of_accounts
      
      return {
        ...item,
        bank_code: bank?.bank_code,
        bank_name: bank?.bank_name,
        account_number: bankAccount?.account_number,
        account_name: bankAccount?.account_name,
        coa_code: coa?.account_code,
        coa_name: coa?.account_name,
        coa_type: coa?.account_type,
        bank_accounts: undefined,
        chart_of_accounts: undefined,
      }
    })
  }
}

export const paymentMethodsRepository = new PaymentMethodsRepository()

