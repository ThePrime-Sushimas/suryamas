import { supabase } from '../../config/supabase'
import { Bank, CreateBankDto, UpdateBankDto, BankListQuery, BankOption } from './banks.types'
import { DatabaseError } from '../../utils/error-handler.util'
import { logDebug, logError } from '../../config/logger'

export class BanksRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: BankListQuery
  ): Promise<{ data: Bank[]; total: number }> {
    const startTime = Date.now()
    
    try {
      let dbQuery = supabase.from('banks').select('*')
      let countQuery = supabase.from('banks').select('*', { count: 'exact', head: true })

      if (query?.search) {
        const searchTerm = query.search.replace(/[%_]/g, '\\$&')
        const pattern = `%${searchTerm}%`
        dbQuery = dbQuery.or(`bank_code.ilike.${pattern},bank_name.ilike.${pattern}`)
        countQuery = countQuery.or(`bank_code.ilike.${pattern},bank_name.ilike.${pattern}`)
      }

      if (query?.is_active !== undefined) {
        dbQuery = dbQuery.eq('is_active', query.is_active)
        countQuery = countQuery.eq('is_active', query.is_active)
      }

      dbQuery = dbQuery.order('bank_name', { ascending: true })

      const [{ data, error }, { count, error: countError }] = await Promise.all([
        dbQuery.range(pagination.offset, pagination.offset + pagination.limit - 1),
        countQuery,
      ])

      if (error) {
        throw new DatabaseError('Failed to fetch banks', {
          cause: error,
          context: { query: 'findAll', filters: query, pagination }
        })
      }
      
      if (countError) {
        throw new DatabaseError('Failed to count banks', {
          cause: countError,
          context: { query: 'findAll', filters: query }
        })
      }

      const duration = Date.now() - startTime
      logDebug('Banks query executed', {
        query: 'findAll',
        duration,
        rowCount: data?.length ?? 0,
        total: count ?? 0
      })

      return { data: data ?? [], total: count ?? 0 }
    } catch (error) {
      logError('Banks repository error', { method: 'findAll', error })
      throw error
    }
  }

  async findById(id: number): Promise<Bank | null> {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw new DatabaseError('Failed to fetch bank by ID', {
          cause: error,
          context: { bankId: id }
        })
      }
      
      return data
    } catch (error) {
      logError('Banks repository error', { method: 'findById', bankId: id, error })
      throw error
    }
  }

  async findByCode(code: string, excludeId?: number): Promise<Bank | null> {
    try {
      let query = supabase
        .from('banks')
        .select('*')
        .eq('bank_code', code)

      if (excludeId) {
        query = query.neq('id', excludeId)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        throw new DatabaseError('Failed to fetch bank by code', {
          cause: error,
          context: { bankCode: code, excludeId }
        })
      }
      
      return data
    } catch (error) {
      logError('Banks repository error', { method: 'findByCode', bankCode: code, error })
      throw error
    }
  }

  async create(data: CreateBankDto): Promise<Bank> {
    try {
      const { data: bank, error } = await supabase
        .from('banks')
        .insert({
          ...data,
          is_active: data.is_active ?? true,
        })
        .select()
        .single()

      if (error) {
        throw new DatabaseError('Failed to create bank', {
          cause: error,
          context: { bankData: data }
        })
      }
      
      return bank
    } catch (error) {
      logError('Banks repository error', { method: 'create', data, error })
      throw error
    }
  }

  async updateById(id: number, updates: UpdateBankDto): Promise<Bank | null> {
    try {
      const { data, error } = await supabase
        .from('banks')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error) {
        throw new DatabaseError('Failed to update bank', {
          cause: error,
          context: { bankId: id, updates }
        })
      }
      
      return data
    } catch (error) {
      logError('Banks repository error', { method: 'updateById', bankId: id, error })
      throw error
    }
  }

  async deleteById(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('banks')
        .update({ is_active: false })
        .eq('id', id)

      if (error) {
        throw new DatabaseError('Failed to delete bank', {
          cause: error,
          context: { bankId: id }
        })
      }
    } catch (error) {
      logError('Banks repository error', { method: 'deleteById', bankId: id, error })
      throw error
    }
  }

  async isUsedInBankAccounts(id: number): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('bank_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('bank_id', id)
        .is('deleted_at', null)

      if (error) {
        throw new DatabaseError('Failed to check bank usage', {
          cause: error,
          context: { bankId: id }
        })
      }
      
      return (count ?? 0) > 0
    } catch (error) {
      logError('Banks repository error', { method: 'isUsedInBankAccounts', bankId: id, error })
      throw error
    }
  }

  async getActiveOptions(): Promise<BankOption[]> {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, bank_code, bank_name')
        .eq('is_active', true)
        .order('bank_name')

      if (error) {
        throw new DatabaseError('Failed to fetch bank options', {
          cause: error,
          context: { query: 'getActiveOptions' }
        })
      }
      
      return data ?? []
    } catch (error) {
      logError('Banks repository error', { method: 'getActiveOptions', error })
      throw error
    }
  }
}

export const banksRepository = new BanksRepository()
