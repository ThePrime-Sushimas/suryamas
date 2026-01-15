import { supabase } from '../../config/supabase'
import { DatabaseError } from '../../utils/error-handler.util'
import { BankAccount, BankAccountWithBank, CreateBankAccountDto, UpdateBankAccountDto, BankAccountListQuery, OwnerType } from './bankAccounts.types'

export class BankAccountsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: BankAccountListQuery
  ): Promise<{ data: BankAccountWithBank[]; total: number }> {
    let dbQuery = supabase
      .from('bank_accounts')
      .select('*, banks(id, bank_code, bank_name), chart_of_accounts(id, account_code, account_name, account_type)', { count: 'exact' })
    
    dbQuery = dbQuery.is('deleted_at', null)

    if (query?.owner_type) {
      dbQuery = dbQuery.eq('owner_type', query.owner_type)
    }

    if (query?.owner_id) {
      dbQuery = dbQuery.eq('owner_id', query.owner_id)
    }

    if (query?.bank_id) {
      dbQuery = dbQuery.eq('bank_id', query.bank_id)
    }

    if (query?.is_active !== undefined) {
      dbQuery = dbQuery.eq('is_active', query.is_active)
    }

    dbQuery = dbQuery.order('is_primary', { ascending: false }).order('created_at', { ascending: false })

    const { data, error, count } = await dbQuery.range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) throw new DatabaseError('Failed to fetch bank accounts', { cause: error })

    const mapped = (data || []).map(item => {
      const bank = Array.isArray(item.banks) ? item.banks[0] : item.banks
      const coa = Array.isArray(item.chart_of_accounts) ? item.chart_of_accounts[0] : item.chart_of_accounts
      return {
        ...item,
        bank_code: bank?.bank_code,
        bank_name: bank?.bank_name,
        bank,
        banks: undefined,
        coa_account: coa ? {
          id: coa.id,
          account_code: coa.account_code,
          account_name: coa.account_name,
          account_type: coa.account_type
        } : null,
        chart_of_accounts: undefined,
      }
    })

    return { data: mapped, total: count || 0 }
  }

  async findById(id: number): Promise<BankAccountWithBank | null> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, banks(id, bank_code, bank_name), chart_of_accounts(id, account_code, account_name, account_type)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch bank account', { cause: error })
    
    if (!data) return null

    const bank = Array.isArray(data.banks) ? data.banks[0] : data.banks
    const coa = Array.isArray(data.chart_of_accounts) ? data.chart_of_accounts[0] : data.chart_of_accounts
    return {
      ...data,
      bank_code: bank?.bank_code,
      bank_name: bank?.bank_name,
      bank,
      banks: undefined,
      coa_account: coa ? {
        id: coa.id,
        account_code: coa.account_code,
        account_name: coa.account_name,
        account_type: coa.account_type
      } : null,
      chart_of_accounts: undefined,
    }
  }

  async findByAccountNumber(bankId: number, accountNumber: string, excludeId?: number): Promise<BankAccount | null> {
    let query = supabase
      .from('bank_accounts')
      .select('*')
      .eq('bank_id', bankId)
      .eq('account_number', accountNumber)
      .is('deleted_at', null)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new DatabaseError('Failed to find bank account by number', { cause: error })
    return data
  }

  async createAtomic(data: CreateBankAccountDto): Promise<BankAccount> {
    const { data: result, error } = await supabase.rpc('create_bank_account_atomic', {
      p_bank_id: data.bank_id,
      p_account_name: data.account_name,
      p_account_number: data.account_number,
      p_owner_type: data.owner_type,
      p_owner_id: data.owner_id,
      p_is_primary: data.is_primary ?? false,
      p_is_active: data.is_active ?? true
    })

    if (error) throw new DatabaseError('Failed to create bank account', { cause: error })
    const account = Array.isArray(result) ? result[0] : result
    if (!account) throw new DatabaseError('Bank account creation returned no data')
    return account
  }

  async updateAtomic(id: number, updates: UpdateBankAccountDto): Promise<BankAccount> {
    const existing = await this.findById(id)
    if (!existing) throw new DatabaseError('Bank account not found')

    const { data: result, error } = await supabase.rpc('update_bank_account_atomic', {
      p_id: id,
      p_account_name: updates.account_name ?? null,
      p_account_number: updates.account_number ?? null,
      p_is_primary: updates.is_primary ?? null,
      p_is_active: updates.is_active ?? null
    })

    if (error) throw new DatabaseError('Failed to update bank account', { cause: error })
    const account = Array.isArray(result) ? result[0] : result
    if (!account) throw new DatabaseError('Bank account update returned no data')
    return account
  }

  async softDelete(id: number, employeeId?: string): Promise<void> {
    const { error } = await supabase
      .from('bank_accounts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: employeeId || null,
        is_active: false,
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new DatabaseError('Failed to delete bank account', { cause: error })
  }

  async unsetPrimaryForOwner(ownerType: OwnerType, ownerId: string, excludeId?: number): Promise<void> {
    let query = supabase
      .from('bank_accounts')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .eq('is_primary', true)
      .is('deleted_at', null)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { error } = await query

    if (error) throw new DatabaseError('Failed to unset primary account', { cause: error })
  }

  async findByOwner(ownerType: OwnerType, ownerId: string): Promise<BankAccountWithBank[]> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, banks(id, bank_code, bank_name), chart_of_accounts(id, account_code, account_name, account_type)')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch accounts by owner', { cause: error })

    return (data || []).map(item => {
      const bank = Array.isArray(item.banks) ? item.banks[0] : item.banks
      const coa = Array.isArray(item.chart_of_accounts) ? item.chart_of_accounts[0] : item.chart_of_accounts
      return {
        ...item,
        bank_code: bank?.bank_code,
        bank_name: bank?.bank_name,
        bank,
        banks: undefined,
        coa_account: coa ? {
          id: coa.id,
          account_code: coa.account_code,
          account_name: coa.account_name,
          account_type: coa.account_type
        } : null,
        chart_of_accounts: undefined,
      }
    })
  }
}

export const bankAccountsRepository = new BankAccountsRepository()
