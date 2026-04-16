import { supabase } from '../../config/supabase'
import type { CashCount, CashCountWithRelations, CashDeposit, CashDepositWithRelations, CashCountListQuery } from './cash-counts.types'
import { CashCountOperationError } from './cash-counts.errors'

export class CashCountsRepository {
  // ── Preview ──
  async previewByBranchDate(startDate: string, endDate: string, paymentMethodId: number) {
    const { data, error } = await supabase
      .from('aggregated_transactions')
      .select('branch_name, transaction_date, nett_amount')
      .eq('payment_method_id', paymentMethodId)
      .gte('transaction_date', startDate).lte('transaction_date', endDate)
      .is('deleted_at', null)
      .is('superseded_by', null)

    if (error) throw new CashCountOperationError('preview', error.message)

    const grouped: Record<string, { branch_name: string; transaction_date: string; amount: number; count: number }> = {}
    for (const row of data || []) {
      const name = row.branch_name || 'Unknown'
      const k = `${name}|${row.transaction_date}`
      if (!grouped[k]) grouped[k] = { branch_name: name, transaction_date: row.transaction_date, amount: 0, count: 0 }
      grouped[k].amount += row.nett_amount || 0
      grouped[k].count += 1
    }

    return Object.values(grouped)
      .map((v) => ({ branch_name: v.branch_name, transaction_date: v.transaction_date, system_balance: v.amount, transaction_count: v.count }))
      .sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.transaction_date.localeCompare(b.transaction_date))
  }

  async findByPeriod(companyId: string, startDate: string, endDate: string, paymentMethodId: number): Promise<CashCount[]> {
    const { data, error } = await supabase.from('cash_counts').select('*')
      .eq('company_id', companyId).gte('start_date', startDate).lte('end_date', endDate)
      .eq('payment_method_id', paymentMethodId).is('deleted_at', null)
    if (error) throw new CashCountOperationError('find_period', error.message)
    return data || []
  }

  // ── Calculate ──
  async calculateSystemBalance(companyId: string, startDate: string, endDate: string, paymentMethodId: number, branchName?: string | null) {
    let query = supabase.from('aggregated_transactions').select('transaction_date, nett_amount')
      .eq('payment_method_id', paymentMethodId).gte('transaction_date', startDate).lte('transaction_date', endDate)
      .is('deleted_at', null).is('superseded_by', null)
    if (branchName) query = query.eq('branch_name', branchName)
    const { data, error } = await query
    if (error) throw new CashCountOperationError('calculate_balance', error.message)

    const rows = data || []
    const byDate: Record<string, { amount: number; count: number }> = {}
    for (const row of rows) {
      const d = row.transaction_date
      if (!byDate[d]) byDate[d] = { amount: 0, count: 0 }
      byDate[d].amount += row.nett_amount || 0
      byDate[d].count += 1
    }
    return {
      totalAmount: rows.reduce((s, r) => s + (r.nett_amount || 0), 0),
      count: rows.length,
      dailyBreakdown: Object.entries(byDate).map(([date, v]) => ({ date, amount: v.amount, count: v.count })).sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  // ── Duplicate check ──
  async findDuplicate(companyId: string, startDate: string, endDate: string, paymentMethodId: number, branchName?: string | null): Promise<CashCount | null> {
    let query = supabase.from('cash_counts').select('*')
      .eq('company_id', companyId).eq('start_date', startDate).eq('end_date', endDate)
      .eq('payment_method_id', paymentMethodId).is('deleted_at', null)
    if (branchName) query = query.eq('branch_name', branchName)
    else query = query.is('branch_name', null)
    const { data, error } = await query.maybeSingle()
    if (error) throw new CashCountOperationError('check_duplicate', error.message)
    return data
  }

  // ── Create cash count ──
  async create(data: {
    company_id: string; start_date: string; end_date: string; branch_name?: string | null;
    payment_method_id: number; system_balance: number; transaction_count: number; notes?: string; created_by?: string;
  }): Promise<CashCount> {
    const { data: cc, error } = await supabase.from('cash_counts').insert({
      company_id: data.company_id, start_date: data.start_date, end_date: data.end_date,
      branch_name: data.branch_name || null, payment_method_id: data.payment_method_id,
      system_balance: data.system_balance, transaction_count: data.transaction_count,
      status: 'OPEN', notes: data.notes, created_by: data.created_by,
    }).select().single()
    if (error) throw new CashCountOperationError('create', error.message)
    return cc
  }

  async findByIds(ids: string[]): Promise<CashCountWithRelations[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase.from('cash_counts').select('*').in('id', ids).is('deleted_at', null)
    if (error) throw new CashCountOperationError('find_batch', error.message)
    if (!data || data.length === 0) return []

    const pmIds = [...new Set(data.map((r: any) => r.payment_method_id).filter(Boolean))]
    const empIds = [...new Set(data.map((r: any) => r.responsible_employee_id).filter(Boolean))]

    let pmMap: Record<number, string> = {}
    if (pmIds.length > 0) {
      const { data: pms } = await supabase.from('payment_methods').select('id, name').in('id', pmIds)
      if (pms) pmMap = pms.reduce((a: any, p: any) => { a[p.id] = p.name; return a }, {})
    }
    let empMap: Record<string, string> = {}
    if (empIds.length > 0) {
      const { data: emps } = await supabase.from('employees').select('id, full_name').in('id', empIds)
      if (emps) empMap = emps.reduce((a: any, e: any) => { a[e.id] = e.full_name; return a }, {})
    }

    return data.map((row: any) => ({
      ...row,
      branch_name: row.branch_name || null,
      payment_method_name: row.payment_method_id ? pmMap[row.payment_method_id] || null : null,
      responsible_employee_name: row.responsible_employee_id ? empMap[row.responsible_employee_id] || null : null,
    }))
  }

  // ── Find by ID ──
  async findById(id: string): Promise<CashCountWithRelations | null> {
    const { data, error } = await supabase
      .from('cash_counts')
      .select('*, payment_methods:payment_method_id(name), employees:responsible_employee_id(full_name)')
      .eq('id', id).is('deleted_at', null).maybeSingle()
    if (error) throw new CashCountOperationError('find', error.message)
    if (!data) return null

    return {
      ...data,
      branch_name: data.branch_name || null,
      payment_method_name: (data.payment_methods as any)?.name || null,
      responsible_employee_name: (data.employees as any)?.full_name || null,
      payment_methods: undefined,
      employees: undefined,
    }
  }

  // ── List ──
  async findAll(companyId: string, pagination: { limit: number; offset: number }, query?: CashCountListQuery) {
    let dbQuery = supabase.from('cash_counts').select('*', { count: 'exact' }).eq('company_id', companyId).is('deleted_at', null)
    if (query?.branch_name) dbQuery = dbQuery.eq('branch_name', query.branch_name)
    if (query?.payment_method_id) dbQuery = dbQuery.eq('payment_method_id', query.payment_method_id)
    if (query?.status) dbQuery = dbQuery.eq('status', query.status)
    if (query?.start_date) dbQuery = dbQuery.gte('start_date', query.start_date)
    if (query?.end_date) dbQuery = dbQuery.lte('end_date', query.end_date)
    dbQuery = dbQuery.order(query?.sort_by || 'created_at', { ascending: (query?.sort_order || 'desc') === 'asc' })

    const { data, error, count } = await dbQuery.range(pagination.offset, pagination.offset + pagination.limit - 1)
    if (error) throw new CashCountOperationError('list', error.message)

    const pmIds = [...new Set((data || []).map((r: any) => r.payment_method_id).filter(Boolean))]
    let pmMap: Record<number, string> = {}
    if (pmIds.length > 0) {
      const { data: pms } = await supabase.from('payment_methods').select('id, name').in('id', pmIds)
      if (pms) pmMap = pms.reduce((a: any, p: any) => { a[p.id] = p.name; return a }, {})
    }
    const empIds = [...new Set((data || []).map((r: any) => r.responsible_employee_id).filter(Boolean))]
    let empMap: Record<string, string> = {}
    if (empIds.length > 0) {
      const { data: emps } = await supabase.from('employees').select('id, full_name').in('id', empIds)
      if (emps) empMap = emps.reduce((a: any, e: any) => { a[e.id] = e.full_name; return a }, {})
    }

    return {
      data: (data || []).map((row: any) => ({
        ...row, branch_name: row.branch_name || null,
        payment_method_name: row.payment_method_id ? pmMap[row.payment_method_id] || null : null,
        responsible_employee_name: row.responsible_employee_id ? empMap[row.responsible_employee_id] || null : null,
      })),
      total: count || 0,
    }
  }

  // ── Update physical count ──
  async updatePhysicalCount(id: string, largeD: number, smallD: number, systemBalance: number, transactionCount: number, responsibleEmployeeId: string | null, notes: string | undefined, userId?: string): Promise<CashCount> {
    const updates: Record<string, any> = {
      large_denomination: largeD, small_denomination: smallD, physical_count: largeD + smallD,
      system_balance: systemBalance, transaction_count: transactionCount,
      responsible_employee_id: responsibleEmployeeId,
      status: 'COUNTED', counted_by: userId, counted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (notes !== undefined) updates.notes = notes
    const { data, error } = await supabase.from('cash_counts').update(updates).eq('id', id).is('deleted_at', null).select().single()
    if (error) throw new CashCountOperationError('update_count', error.message)
    return data
  }

  // ── Close ──
  async close(id: string, userId?: string): Promise<CashCount> {
    const { data, error } = await supabase.from('cash_counts')
      .update({ status: 'CLOSED', closed_by: userId, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).is('deleted_at', null).select().single()
    if (error) throw new CashCountOperationError('close', error.message)
    return data
  }

  // ── Soft delete ──
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from('cash_counts').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null)
    if (error) throw new CashCountOperationError('delete', error.message)
  }

  // ════════════════════════════════════════════
  // CASH DEPOSITS
  // ════════════════════════════════════════════

  async createDeposit(data: {
    company_id: string; deposit_amount: number; deposit_date: string; bank_account_id: number;
    reference?: string; branch_name?: string; payment_method_id?: number;
    period_start?: string; period_end?: string; item_count: number; notes?: string; created_by?: string;
  }): Promise<CashDeposit> {
    const { data: dep, error } = await supabase.from('cash_deposits').insert({
      company_id: data.company_id, deposit_amount: data.deposit_amount, deposit_date: data.deposit_date,
      bank_account_id: data.bank_account_id, reference: data.reference || null,
      status: 'PENDING', branch_name: data.branch_name || null, payment_method_id: data.payment_method_id || null,
      period_start: data.period_start || null, period_end: data.period_end || null,
      item_count: data.item_count, notes: data.notes || null, created_by: data.created_by || null,
    }).select().single()
    if (error) throw new CashCountOperationError('create_deposit', error.message)
    return dep
  }

  async linkCashCountsToDeposit(cashCountIds: string[], depositId: string, userId?: string): Promise<void> {
    const { error } = await supabase.from('cash_counts').update({
      cash_deposit_id: depositId, status: 'DEPOSITED', updated_at: new Date().toISOString(),
    }).in('id', cashCountIds).is('deleted_at', null)
    if (error) throw new CashCountOperationError('link_deposit', error.message)
  }

  async findDepositById(id: string): Promise<CashDepositWithRelations | null> {
    const { data, error } = await supabase.from('cash_deposits').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
    if (error) throw new CashCountOperationError('find_deposit', error.message)
    if (!data) return null

    let bankName: string | null = null
    if (data.bank_account_id) {
      const { data: ba } = await supabase.from('bank_accounts').select('account_name, banks(bank_name)').eq('id', data.bank_account_id).maybeSingle()
      bankName = ba ? `${(ba.banks as any)?.bank_name || ''} - ${ba.account_name}` : null
    }

    const { data: items } = await supabase.from('cash_counts').select('*').eq('cash_deposit_id', id).is('deleted_at', null).order('start_date', { ascending: true })

    return { ...data, bank_account_name: bankName, items: items || [] }
  }

  async listDeposits(companyId: string, pagination: { limit: number; offset: number }) {
    const { data, error, count } = await supabase.from('cash_deposits').select('*', { count: 'exact' })
      .eq('company_id', companyId).is('deleted_at', null).order('deposit_date', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
    if (error) throw new CashCountOperationError('list_deposits', error.message)
    return { data: data || [], total: count || 0 }
  }

  async confirmDeposit(depositId: string, proofUrl: string, depositedAt: string, userId?: string): Promise<CashDeposit> {
    const { data, error } = await supabase.from('cash_deposits').update({
      status: 'DEPOSITED', proof_url: proofUrl, deposited_at: depositedAt,
      deposited_by: userId || null, updated_at: new Date().toISOString(),
    }).eq('id', depositId).is('deleted_at', null).select().single()
    if (error) throw new CashCountOperationError('confirm_deposit', error.message)
    return data
  }

  async reconcileDeposit(depositId: string, bankStatementId: string): Promise<void> {
    const { error } = await supabase.from('cash_deposits').update({
      status: 'RECONCILED', bank_statement_id: bankStatementId, updated_at: new Date().toISOString(),
    }).eq('id', depositId)
    if (error) throw new CashCountOperationError('reconcile_deposit', error.message)
  }

  async getDepositedForMatch(startDate: string, endDate: string, bankAccountId?: number): Promise<CashDeposit[]> {
    let query = supabase.from('cash_deposits').select('*')
      .eq('status', 'DEPOSITED')
      .gte('deposit_date', startDate)
      .lte('deposit_date', endDate)
      .is('deleted_at', null)
    if (bankAccountId) query = query.eq('bank_account_id', bankAccountId)
    const { data, error } = await query.order('deposit_date', { ascending: true })
    if (error) throw new CashCountOperationError('get_deposited_for_match', error.message)
    return data || []
  }

  async closeCashCountsByDeposit(depositId: string, userId?: string): Promise<void> {
    const { error } = await supabase.from('cash_counts').update({
      status: 'CLOSED', closed_by: userId, closed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('cash_deposit_id', depositId).is('deleted_at', null)
    if (error) throw new CashCountOperationError('close_by_deposit', error.message)
  }

  async deleteDeposit(id: string): Promise<void> {
    // Unlink cash counts first
    const { error: unlinkErr } = await supabase.from('cash_counts').update({
      cash_deposit_id: null, status: 'COUNTED', updated_at: new Date().toISOString(),
    }).eq('cash_deposit_id', id).is('deleted_at', null)
    if (unlinkErr) throw new CashCountOperationError('unlink_deposit', unlinkErr.message)

    const { error } = await supabase.from('cash_deposits').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new CashCountOperationError('delete_deposit', error.message)
  }
}

export const cashCountsRepository = new CashCountsRepository()
