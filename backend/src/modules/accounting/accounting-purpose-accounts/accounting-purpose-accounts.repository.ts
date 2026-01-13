import { supabase } from '../../../config/supabase'
import { 
  AccountingPurposeAccount, 
  CreateAccountingPurposeAccountDTO, 
  UpdateAccountingPurposeAccountDTO,
  AccountingPurposeAccountWithDetails
} from './accounting-purpose-accounts.types'
import { logError } from '../../../config/logger'

interface TransactionContext {
  client: any
}

export class AccountingPurposeAccountsRepository {
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
    filter?: any,
    trx?: TransactionContext
  ): Promise<{ data: AccountingPurposeAccountWithDetails[]; total: number }> {
    const client = trx?.client || supabase
    
    let query = client
      .from('accounting_purpose_accounts')
      .select(`
        *,
        accounting_purposes!inner(purpose_name, purpose_code),
        chart_of_accounts!inner(account_code, account_name, account_type, normal_balance)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
    
    let countQuery = client
      .from('accounting_purpose_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null)
    
    if (filter) {
      if (filter.purpose_id) {
        query = query.eq('purpose_id', filter.purpose_id)
        countQuery = countQuery.eq('purpose_id', filter.purpose_id)
      }
      if (filter.side) {
        query = query.eq('side', filter.side)
        countQuery = countQuery.eq('side', filter.side)
      }
      if (filter.is_required !== undefined) {
        query = query.eq('is_required', filter.is_required)
        countQuery = countQuery.eq('is_required', filter.is_required)
      }
      // Remove account_type filter since it's not in this table
      // if (filter.account_type) {
      //   query = query.eq('chart_of_accounts.account_type', filter.account_type)
      //   countQuery = countQuery.eq('chart_of_accounts.account_type', filter.account_type)
      // }
    }
    
    if (sort) {
      const validFields = ['priority', 'side', 'created_at', 'updated_at']
      if (validFields.includes(sort.field)) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      }
      // Remove account_name sort since it's not in this table
    } else {
      query = query.order('priority', { ascending: true }).order('side', { ascending: true })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    const mappedData = (data || []).map((item: any) => ({
      ...item,
      purpose_name: item.accounting_purposes?.purpose_name,
      purpose_code: item.accounting_purposes?.purpose_code,
      account_code: item.chart_of_accounts?.account_code,
      account_name: item.chart_of_accounts?.account_name,
      account_type: item.chart_of_accounts?.account_type,
      normal_balance: item.chart_of_accounts?.normal_balance,
    }))
    
    return { data: mappedData, total: count || 0 }
  }

  async findById(id: string, trx?: TransactionContext): Promise<AccountingPurposeAccount | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('accounting_purpose_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByPurposeAndAccount(
    purposeId: string, 
    accountId: string, 
    side: string,
    trx?: TransactionContext
  ): Promise<AccountingPurposeAccount | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('accounting_purpose_accounts')
      .select('*')
      .eq('purpose_id', purposeId)
      .eq('account_id', accountId)
      .eq('side', side)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async getNextPriority(purposeId: string, side: string, trx?: TransactionContext): Promise<number> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('accounting_purpose_accounts')
      .select('priority')
      .eq('purpose_id', purposeId)
      .eq('side', side)
      .order('priority', { ascending: false })
      .limit(1)

    if (error) throw new Error(error.message)
    return data && data.length > 0 ? data[0].priority + 1 : 1
  }

  async create(data: CreateAccountingPurposeAccountDTO, companyId: string, userId: string, trx?: TransactionContext): Promise<AccountingPurposeAccount | null> {
    const client = trx?.client || supabase
    
    const priority = data.priority || await this.getNextPriority(data.purpose_id, data.side, trx)
    
    const { data: account, error } = await client
      .from('accounting_purpose_accounts')
      .insert({
        ...data,
        company_id: companyId,
        priority,
        is_required: data.is_required ?? true,
        is_auto: data.is_auto ?? true,
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
    
    this.invalidateCache()
    return account
  }

  async update(id: string, updates: UpdateAccountingPurposeAccountDTO, trx?: TransactionContext): Promise<AccountingPurposeAccount | null> {
    const client = trx?.client || supabase
    const { data, error } = await client
      .from('accounting_purpose_accounts')
      .update({ ...updates, updated_at: new Date().toISOString() })
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

  async delete(id: string, userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('accounting_purpose_accounts')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async bulkCreate(
    purposeId: string,
    accounts: Array<{ account_id: string; side: 'DEBIT' | 'CREDIT'; is_required?: boolean; is_auto?: boolean; priority?: number }>,
    companyId: string,
    userId: string,
    trx?: TransactionContext
  ): Promise<AccountingPurposeAccount[]> {
    const client = trx?.client || supabase
    
    // Assign priorities for accounts without them
    const accountsWithPriority = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        purpose_id: purposeId,
        company_id: companyId,
        is_required: account.is_required ?? true,
        is_auto: account.is_auto ?? true,
        priority: account.priority || await this.getNextPriority(purposeId, account.side, trx),
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    )
    
    const { data, error } = await client
      .from('accounting_purpose_accounts')
      .insert(accountsWithPriority)
      .select()

    if (error) {
      logError('Repository bulk create error', { error: error.message, code: error.code })
      throw error
    }
    
    this.invalidateCache(companyId)
    return data || []
  }

  async bulkRemove(purposeId: string, accountIds: string[], userId: string, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('accounting_purpose_accounts')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('purpose_id', purposeId)
      .in('account_id', accountIds)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, trx?: TransactionContext): Promise<void> {
    const client = trx?.client || supabase
    const { error } = await client
      .from('accounting_purpose_accounts')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async exportData(companyId: string, filter?: any, limit: number = 10000): Promise<AccountingPurposeAccountWithDetails[]> {
    let query = supabase
      .from('accounting_purpose_accounts')
      .select(`
        *,
        accounting_purposes!inner(purpose_name, purpose_code),
        chart_of_accounts!inner(account_code, account_name, account_type, normal_balance)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .limit(limit)
    
    if (filter) {
      if (filter.purpose_id) query = query.eq('purpose_id', filter.purpose_id)
      if (filter.side) query = query.eq('side', filter.side)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
    }
    
    const { data, error } = await query.order('priority', { ascending: true })
    if (error) {
      logError('Repository export error', { error: error.message })
      throw new Error(error.message)
    }
    
    return (data || []).map(item => ({
      ...item,
      purpose_name: item.accounting_purposes?.purpose_name,
      purpose_code: item.accounting_purposes?.purpose_code,
      account_code: item.chart_of_accounts?.account_code,
      account_name: item.chart_of_accounts?.account_name,
      account_type: item.chart_of_accounts?.account_type,
      normal_balance: item.chart_of_accounts?.normal_balance,
    }))
  }
}

export const accountingPurposeAccountsRepository = new AccountingPurposeAccountsRepository()