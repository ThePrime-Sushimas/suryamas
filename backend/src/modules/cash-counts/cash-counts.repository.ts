import { supabase } from '../../config/supabase'
import type {
  CashCount,
  CashCountWithRelations,
  CashCountDetail,
  CashCountListQuery,
} from './cash-counts.types'
import { CashCountOperationError } from './cash-counts.errors'

export class CashCountsRepository {
  /**
   * Calculate system balance from aggregated_transactions
   */
  async calculateSystemBalance(
    companyId: string,
    startDate: string,
    endDate: string,
    paymentMethodId: number,
    branchId?: string | null,
  ): Promise<{ totalAmount: number; count: number; dailyBreakdown: { date: string; amount: number; count: number }[] }> {
    let query = supabase
      .from('aggregated_transactions')
      .select('transaction_date, nett_amount')
      .eq('company_id', companyId)
      .eq('payment_method_id', paymentMethodId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .is('deleted_at', null)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw new CashCountOperationError('calculate_balance', error.message)

    const rows = data || []
    const totalAmount = rows.reduce((sum, r) => sum + (r.nett_amount || 0), 0)

    // Group by date
    const byDate: Record<string, { amount: number; count: number }> = {}
    for (const row of rows) {
      const d = row.transaction_date
      if (!byDate[d]) byDate[d] = { amount: 0, count: 0 }
      byDate[d].amount += row.nett_amount || 0
      byDate[d].count += 1
    }

    const dailyBreakdown = Object.entries(byDate)
      .map(([date, v]) => ({ date, amount: v.amount, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { totalAmount, count: rows.length, dailyBreakdown }
  }

  /**
   * Check if duplicate cash count exists for same period/branch/pm
   */
  async findDuplicate(
    companyId: string,
    startDate: string,
    endDate: string,
    paymentMethodId: number,
    branchId?: string | null,
  ): Promise<CashCount | null> {
    let query = supabase
      .from('cash_counts')
      .select('*')
      .eq('company_id', companyId)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .eq('payment_method_id', paymentMethodId)
      .is('deleted_at', null)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    } else {
      query = query.is('branch_id', null)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw new CashCountOperationError('check_duplicate', error.message)
    return data
  }

  /**
   * Create cash count header + details
   */
  async create(
    data: {
      company_id: string
      start_date: string
      end_date: string
      branch_id?: string | null
      payment_method_id: number
      system_balance: number
      transaction_count: number
      notes?: string
      created_by?: string
    },
    details: { transaction_date: string; amount: number; transaction_count: number }[],
  ): Promise<CashCount> {
    const { data: cashCount, error } = await supabase
      .from('cash_counts')
      .insert({
        company_id: data.company_id,
        start_date: data.start_date,
        end_date: data.end_date,
        branch_id: data.branch_id || null,
        payment_method_id: data.payment_method_id,
        system_balance: data.system_balance,
        transaction_count: data.transaction_count,
        status: 'OPEN',
        notes: data.notes,
        created_by: data.created_by,
      })
      .select()
      .single()

    if (error) throw new CashCountOperationError('create', error.message)

    // Insert details
    if (details.length > 0) {
      const detailRows = details.map((d) => ({
        cash_count_id: cashCount.id,
        transaction_date: d.transaction_date,
        amount: d.amount,
        transaction_count: d.transaction_count,
      }))

      const { error: detailError } = await supabase
        .from('cash_count_details')
        .insert(detailRows)

      if (detailError) throw new CashCountOperationError('create_details', detailError.message)
    }

    return cashCount
  }

  /**
   * Find by ID with relations
   */
  async findById(id: string): Promise<CashCountWithRelations | null> {
    const { data, error } = await supabase
      .from('cash_counts')
      .select(`
        *,
        branches(branch_name),
        payment_methods(name),
        employees!fk_cash_counts_responsible_employee(full_name),
        bank_accounts(account_name, banks(bank_name))
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new CashCountOperationError('find', error.message)
    if (!data) return null

    // Fetch details
    const { data: details } = await supabase
      .from('cash_count_details')
      .select('*')
      .eq('cash_count_id', id)
      .order('transaction_date', { ascending: true })

    return {
      ...data,
      branch_name: data.branches?.branch_name || null,
      payment_method_name: (data.payment_methods as any)?.name || null,
      responsible_employee_name: (data.employees as any)?.full_name || null,
      deposit_bank_name: data.bank_accounts?.banks?.bank_name
        ? `${data.bank_accounts.banks.bank_name} - ${data.bank_accounts.account_name}`
        : null,
      details: details || [],
    }
  }

  /**
   * List with pagination and filters
   */
  async findAll(
    pagination: { limit: number; offset: number },
    query?: CashCountListQuery,
  ): Promise<{ data: CashCountWithRelations[]; total: number }> {
    let dbQuery = supabase
      .from('cash_counts')
      .select(`
        *,
        branches(branch_name),
        payment_methods(name),
        employees!fk_cash_counts_responsible_employee(full_name)
      `, { count: 'exact' })
      .is('deleted_at', null)

    if (query?.branch_id) dbQuery = dbQuery.eq('branch_id', query.branch_id)
    if (query?.payment_method_id) dbQuery = dbQuery.eq('payment_method_id', query.payment_method_id)
    if (query?.status) dbQuery = dbQuery.eq('status', query.status)
    if (query?.start_date) dbQuery = dbQuery.gte('start_date', query.start_date)
    if (query?.end_date) dbQuery = dbQuery.lte('end_date', query.end_date)

    const sortBy = query?.sort_by || 'created_at'
    const sortOrder = query?.sort_order || 'desc'
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data, error, count } = await dbQuery.range(
      pagination.offset,
      pagination.offset + pagination.limit - 1,
    )

    if (error) throw new CashCountOperationError('list', error.message)

    const mapped = (data || []).map((row: any) => ({
      ...row,
      branch_name: row.branches?.branch_name || null,
      payment_method_name: row.payment_methods?.name || null,
      responsible_employee_name: row.employees?.full_name || null,
    }))

    return { data: mapped, total: count || 0 }
  }

  /**
   * Update physical count (OPEN → COUNTED)
   */
  async updatePhysicalCount(
    id: string,
    physicalCount: number,
    responsibleEmployeeId: string | null,
    notes: string | undefined,
    userId?: string,
  ): Promise<CashCount> {
    const updates: Record<string, any> = {
      physical_count: physicalCount,
      responsible_employee_id: responsibleEmployeeId,
      status: 'COUNTED',
      counted_by: userId,
      counted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('cash_counts')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) throw new CashCountOperationError('update_count', error.message)
    return data
  }

  /**
   * Update deposit info (COUNTED → DEPOSITED)
   */
  async updateDeposit(
    id: string,
    deposit: {
      deposit_amount: number
      deposit_date: string
      deposit_bank_account_id: number
      deposit_reference?: string
      notes?: string
    },
    userId?: string,
  ): Promise<CashCount> {
    const updates: Record<string, any> = {
      deposit_amount: deposit.deposit_amount,
      deposit_date: deposit.deposit_date,
      deposit_bank_account_id: deposit.deposit_bank_account_id,
      deposit_reference: deposit.deposit_reference || null,
      status: 'DEPOSITED',
      deposited_by: userId,
      deposited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (deposit.notes !== undefined) updates.notes = deposit.notes

    const { data, error } = await supabase
      .from('cash_counts')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) throw new CashCountOperationError('update_deposit', error.message)
    return data
  }

  /**
   * Close cash count (DEPOSITED → CLOSED)
   */
  async close(id: string, userId?: string): Promise<CashCount> {
    const { data, error } = await supabase
      .from('cash_counts')
      .update({
        status: 'CLOSED',
        closed_by: userId,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) throw new CashCountOperationError('close', error.message)
    return data
  }

  /**
   * Soft delete
   */
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('cash_counts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new CashCountOperationError('delete', error.message)
  }
}

export const cashCountsRepository = new CashCountsRepository()
