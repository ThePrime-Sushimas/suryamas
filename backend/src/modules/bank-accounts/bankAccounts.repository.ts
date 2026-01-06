import { supabase } from '../../config/supabase'
import { BankAccount, BankAccountWithBank, CreateBankAccountDto, UpdateBankAccountDto, BankAccountListQuery, OwnerType } from './bankAccounts.types'

export class BankAccountsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: BankAccountListQuery
  ): Promise<{ data: BankAccountWithBank[]; total: number }> {
    let dbQuery = supabase.from('bank_accounts').select('*, banks(id, bank_code, bank_name)', { count: 'exact' })
    
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

    if (error) throw new Error(error.message)

    const mapped = (data || []).map(item => ({
      ...item,
      bank: Array.isArray(item.banks) ? item.banks[0] : item.banks,
      banks: undefined,
    }))

    return { data: mapped, total: count || 0 }
  }

  async findById(id: number): Promise<BankAccountWithBank | null> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, banks(id, bank_code, bank_name)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    
    if (!data) return null

    return {
      ...data,
      bank: Array.isArray(data.banks) ? data.banks[0] : data.banks,
      banks: undefined,
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

    if (error) throw new Error(error.message)
    return data
  }

  // FIX #1: Atomic create using database function
  async createAtomic(data: CreateBankAccountDto): Promise<BankAccount> {
    const { data: account, error } = await supabase.rpc('create_bank_account_atomic', {
      p_bank_id: data.bank_id,
      p_account_name: data.account_name,
      p_account_number: data.account_number,
      p_owner_type: data.owner_type,
      p_owner_id: data.owner_id,
      p_is_primary: data.is_primary ?? false,
      p_is_active: data.is_active ?? true
    })

    if (error) throw new Error(error.message)
    return account
  }

  // FIX #1: Atomic update using database function
  async updateAtomic(id: number, updates: UpdateBankAccountDto): Promise<BankAccount> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Bank account not found')

    const { data: account, error } = await supabase.rpc('update_bank_account_atomic', {
      p_id: id,
      p_account_name: updates.account_name ?? null,
      p_account_number: updates.account_number ?? null,
      p_is_primary: updates.is_primary ?? null,
      p_is_active: updates.is_active ?? null
    })

    if (error) throw new Error(error.message)
    return account
  }

  // FIX #5: Add userId parameter for audit trail
  async softDelete(id: number, userId?: number): Promise<void> {
    const { error } = await supabase
      .from('bank_accounts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        is_active: false,
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new Error(error.message)
  }

  async unsetPrimaryForOwner(ownerType: OwnerType, ownerId: number, excludeId?: number): Promise<void> {
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

    if (error) throw new Error(error.message)
  }

  async findByOwner(ownerType: OwnerType, ownerId: number): Promise<BankAccountWithBank[]> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, banks(id, bank_code, bank_name)')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return (data || []).map(item => ({
      ...item,
      bank: Array.isArray(item.banks) ? item.banks[0] : item.banks,
      banks: undefined,
    }))
  }
}

export const bankAccountsRepository = new BankAccountsRepository()
