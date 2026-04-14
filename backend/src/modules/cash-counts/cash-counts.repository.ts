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
   * Preview: get all branches x dates with cash balance for a period + payment method
   * Groups by branch_name + date (branch_name always exists)
   */
  async previewByBranchDate(
    startDate: string,
    endDate: string,
    paymentMethodId: number,
  ): Promise<{ branch_name: string; transaction_date: string; system_balance: number; transaction_count: number }[]> {
    const { data, error } = await supabase
      .from('aggregated_transactions')
      .select('branch_name, transaction_date, nett_amount')
      .eq('payment_method_id', paymentMethodId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .is('deleted_at', null)

    if (error) throw new CashCountOperationError('preview', error.message)

    const key = (name: string, d: string) => `${name}|${d}`
    const grouped: Record<string, { branch_name: string; transaction_date: string; amount: number; count: number }> = {}

    for (const row of data || []) {
      const name = row.branch_name || 'Unknown'
      const k = key(name, row.transaction_date)
      if (!grouped[k]) {
        grouped[k] = { branch_name: name, transaction_date: row.transaction_date, amount: 0, count: 0 }
      }
      grouped[k].amount += row.nett_amount || 0
      grouped[k].count += 1
    }

    return Object.values(grouped)
      .map((v) => ({ branch_name: v.branch_name, transaction_date: v.transaction_date, system_balance: v.amount, transaction_count: v.count }))
      .sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.transaction_date.localeCompare(b.transaction_date))
  }

  /**
   * Find existing cash counts for a period + payment method (all branches)
   */
  async findByPeriod(
    companyId: string,
    startDate: string,
    endDate: string,
    paymentMethodId: number,
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('cash_counts')
      .select('*')
      .eq('company_id', companyId)
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .eq('payment_method_id', paymentMethodId)
      .is('deleted_at', null)

    if (error) throw new CashCountOperationError('find_period', error.message)
    return data || []
  }

  /**
   * Calculate system balance from aggregated_transactions (single branch)
   */
  async calculateSystemBalance(
    companyId: string,
    startDate: string,
    endDate: string,
    paymentMethodId: number,
    branchName?: string | null,
  ): Promise<{ totalAmount: number; count: number; dailyBreakdown: { date: string; amount: number; count: number }[] }> {
    let query = supabase
      .from('aggregated_transactions')
      .select('transaction_date, nett_amount')
      .eq('payment_method_id', paymentMethodId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .is('deleted_at', null)

    if (branchName) query = query.eq('branch_name', branchName)

    const { data, error } = await query
    if (error) throw new CashCountOperationError('calculate_balance', error.message)

    const rows = data || []
    const totalAmount = rows.reduce((sum, r) => sum + (r.nett_amount || 0), 0)

    const byDate: Record<string, { amount: number; count: number }> = {}
    for (const row of rows) {
      const d = row.transaction_date
      if (!byDate[d]) byDate[d] = { amount: 0, count: 0 }
      byDate[d].amount += row.nett_amount || 0
      byDate[d].count += 1
    }

    return {
      totalAmount,
      count: rows.length,
      dailyBreakdown: Object.entries(byDate)
        .map(([date, v]) => ({ date, amount: v.amount, count: v.count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  /**
   * Check duplicate
   */
  async findDuplicate(
    companyId: string, startDate: string, endDate: string, paymentMethodId: number, branchName?: string | null,
  ): Promise<CashCount | null> {
    let query = supabase
      .from('cash_counts').select('*')
      .eq('company_id', companyId).eq('start_date', startDate).eq('end_date', endDate)
      .eq('payment_method_id', paymentMethodId).is('deleted_at', null)

    if (branchName) query = query.eq('branch_name', branchName)
    else query = query.is('branch_name', null)

    const { data, error } = await query.maybeSingle()
    if (error) throw new CashCountOperationError('check_duplicate', error.message)
    return data
  }

  /**
   * Create cash count header + details
   */
  async create(
    data: {
      company_id: string; start_date: string; end_date: string; branch_name?: string | null;
      payment_method_id: number; system_balance: number; transaction_count: number; notes?: string; created_by?: string;
    },
    details: { transaction_date: string; amount: number; transaction_count: number }[],
  ): Promise<CashCount> {
    const { data: cashCount, error } = await supabase
      .from('cash_counts')
      .insert({
        company_id: data.company_id, start_date: data.start_date, end_date: data.end_date,
        branch_name: data.branch_name || null, payment_method_id: data.payment_method_id,
        system_balance: data.system_balance, transaction_count: data.transaction_count,
        status: 'OPEN', notes: data.notes, created_by: data.created_by,
      })
      .select().single()

    if (error) throw new CashCountOperationError('create', error.message)

    if (details.length > 0) {
      const { error: detailError } = await supabase
        .from('cash_count_details')
        .insert(details.map((d) => ({ cash_count_id: cashCount.id, ...d })))
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
      .select(`*`)
      .eq('id', id).is('deleted_at', null).maybeSingle()

    if (error) throw new CashCountOperationError('find', error.message)
    if (!data) return null

    // Payment method name
    let pmName: string | null = null
    if (data.payment_method_id) {
      const { data: pm } = await supabase.from('payment_methods').select('name').eq('id', data.payment_method_id).maybeSingle()
      pmName = pm?.name || null
    }

    // Employee name
    let employeeName: string | null = null
    if (data.responsible_employee_id) {
      const { data: emp } = await supabase.from('employees').select('full_name').eq('id', data.responsible_employee_id).maybeSingle()
      employeeName = emp?.full_name || null
    }

    // Bank account name
    let bankName: string | null = null
    if (data.deposit_bank_account_id) {
      const { data: ba } = await supabase.from('bank_accounts').select('account_name, banks(bank_name)').eq('id', data.deposit_bank_account_id).maybeSingle()
      bankName = ba ? `${(ba.banks as any)?.bank_name || ''} - ${ba.account_name}` : null
    }

    const { data: details } = await supabase
      .from('cash_count_details').select('*').eq('cash_count_id', id).order('transaction_date', { ascending: true })

    return {
      ...data,
      branch_name: data.branch_name || null,
      payment_method_name: pmName,
      responsible_employee_name: employeeName,
      deposit_bank_name: bankName,
      details: details || [],
    }
  }

  /**
   * List with pagination and filters
   */
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    query?: CashCountListQuery,
  ): Promise<{ data: CashCountWithRelations[]; total: number }> {
    let dbQuery = supabase
      .from('cash_counts')
      .select(`*`, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (query?.branch_id) dbQuery = dbQuery.eq('branch_name', query.branch_id)
    if (query?.payment_method_id) dbQuery = dbQuery.eq('payment_method_id', query.payment_method_id)
    if (query?.status) dbQuery = dbQuery.eq('status', query.status)
    if (query?.start_date) dbQuery = dbQuery.gte('start_date', query.start_date)
    if (query?.end_date) dbQuery = dbQuery.lte('end_date', query.end_date)

    dbQuery = dbQuery.order(query?.sort_by || 'created_at', { ascending: (query?.sort_order || 'desc') === 'asc' })

    const { data, error, count } = await dbQuery.range(pagination.offset, pagination.offset + pagination.limit - 1)
    if (error) throw new CashCountOperationError('list', error.message)

    // Batch fetch payment method names
    const pmIds = [...new Set((data || []).map((r: any) => r.payment_method_id).filter(Boolean))]
    let pmMap: Record<number, string> = {}
    if (pmIds.length > 0) {
      const { data: pms } = await supabase.from('payment_methods').select('id, name').in('id', pmIds)
      if (pms) pmMap = pms.reduce((acc: Record<number, string>, p: any) => { acc[p.id] = p.name; return acc }, {})
    }

    // Batch fetch employee names
    const empIds = [...new Set((data || []).map((r: any) => r.responsible_employee_id).filter(Boolean))]
    let empMap: Record<string, string> = {}
    if (empIds.length > 0) {
      const { data: emps } = await supabase.from('employees').select('id, full_name').in('id', empIds)
      if (emps) empMap = emps.reduce((acc: Record<string, string>, e: any) => { acc[e.id] = e.full_name; return acc }, {})
    }

    const mapped = (data || []).map((row: any) => ({
      ...row,
      branch_name: row.branch_name || null,
      payment_method_name: row.payment_method_id ? pmMap[row.payment_method_id] || null : null,
      responsible_employee_name: row.responsible_employee_id ? empMap[row.responsible_employee_id] || null : null,
    }))

    return { data: mapped, total: count || 0 }
  }

  async updatePhysicalCount(id: string, largeD: number, smallD: number, responsibleEmployeeId: string | null, notes: string | undefined, userId?: string): Promise<CashCount> {
    const physicalCount = largeD + smallD
    const updates: Record<string, any> = {
      large_denomination: largeD, small_denomination: smallD, physical_count: physicalCount,
      responsible_employee_id: responsibleEmployeeId,
      status: 'COUNTED', counted_by: userId, counted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (notes !== undefined) updates.notes = notes
    const { data, error } = await supabase.from('cash_counts').update(updates).eq('id', id).is('deleted_at', null).select().single()
    if (error) throw new CashCountOperationError('update_count', error.message)
    return data
  }

  async updateDeposit(id: string, deposit: { deposit_amount: number; deposit_date: string; deposit_bank_account_id: number; deposit_reference?: string; notes?: string }, userId?: string): Promise<CashCount> {
    const updates: Record<string, any> = {
      deposit_amount: deposit.deposit_amount, deposit_date: deposit.deposit_date,
      deposit_bank_account_id: deposit.deposit_bank_account_id, deposit_reference: deposit.deposit_reference || null,
      status: 'DEPOSITED', deposited_by: userId, deposited_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (deposit.notes !== undefined) updates.notes = deposit.notes
    const { data, error } = await supabase.from('cash_counts').update(updates).eq('id', id).is('deleted_at', null).select().single()
    if (error) throw new CashCountOperationError('update_deposit', error.message)
    return data
  }

  async close(id: string, userId?: string): Promise<CashCount> {
    const { data, error } = await supabase.from('cash_counts')
      .update({ status: 'CLOSED', closed_by: userId, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).is('deleted_at', null).select().single()
    if (error) throw new CashCountOperationError('close', error.message)
    return data
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from('cash_counts').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null)
    if (error) throw new CashCountOperationError('delete', error.message)
  }
}

export const cashCountsRepository = new CashCountsRepository()
