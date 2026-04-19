import { supabase } from '../../config/supabase'
import { logError, logInfo } from '../../config/logger'
import { DatabaseError } from '../../utils/error-handler.util'
import type {
  PaymentMethodGroup,
  PaymentMethodGroupMapping,
  CreateGroupDto,
  UpdateGroupDto,
  AvailablePaymentMethod,
  SalesBreakdownItem,
  SalesGroup,
  RunningBalanceRow,
  CashFlowSummary,
  GetCashFlowParams,
  AccountPeriodBalance,
  CreatePeriodBalanceDto,
  UpdatePeriodBalanceDto,
  OpeningBalanceSuggestion,
} from './cash-flow-sales.types'

export class CashFlowSalesRepository {

  // ============================================================
  // Shared: Bank Account Info
  // ============================================================

  async getBankAccountInfo(bankAccountId: number, companyId: string): Promise<{
    id: number; bank_name: string; account_number: string; account_name: string
  } | null> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('id, account_number, account_name, banks!inner(bank_name)')
      .eq('id', bankAccountId)
      .eq('owner_id', companyId)
      .eq('owner_type', 'company')
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return {
      id: data.id,
      bank_name: (data.banks as any)?.bank_name || '',
      account_number: data.account_number,
      account_name: data.account_name,
    }
  }

  // ============================================================
  // Period Balance CRUD
  // ============================================================

  async createPeriodBalance(dto: CreatePeriodBalanceDto): Promise<AccountPeriodBalance> {
    const { data, error } = await supabase
      .from('account_period_balances')
      .insert({
        company_id: dto.company_id, bank_account_id: dto.bank_account_id,
        period_start: dto.period_start, period_end: dto.period_end,
        opening_balance: dto.opening_balance, source: dto.source || 'MANUAL',
        previous_period_id: dto.previous_period_id || null,
        notes: dto.notes || null, created_by: dto.created_by || null,
      })
      .select().single()
    if (error) throw new DatabaseError('Failed to create period balance', { cause: error })
    return data as AccountPeriodBalance
  }

  async updatePeriodBalance(id: string, companyId: string, dto: UpdatePeriodBalanceDto): Promise<AccountPeriodBalance> {
    const updateData: Record<string, any> = { updated_by: dto.updated_by || null }
    if (dto.period_start !== undefined) updateData.period_start = dto.period_start
    if (dto.period_end !== undefined) updateData.period_end = dto.period_end
    if (dto.opening_balance !== undefined) updateData.opening_balance = dto.opening_balance
    if (dto.source !== undefined) updateData.source = dto.source
    if (dto.notes !== undefined) updateData.notes = dto.notes

    const { data, error } = await supabase
      .from('account_period_balances').update(updateData)
      .eq('id', id).eq('company_id', companyId).select().single()
    if (error) throw new DatabaseError('Failed to update period balance', { cause: error })
    return data as AccountPeriodBalance
  }

  async deletePeriodBalance(id: string, companyId: string): Promise<void> {
    const { error } = await supabase.from('account_period_balances').delete().eq('id', id).eq('company_id', companyId)
    if (error) throw new DatabaseError('Failed to delete period balance', { cause: error })
  }

  async findPeriodBalanceById(id: string, companyId: string): Promise<AccountPeriodBalance | null> {
    const { data, error } = await supabase
      .from('account_period_balances').select('*').eq('id', id).eq('company_id', companyId).maybeSingle()
    if (error) return null
    return data as AccountPeriodBalance
  }

  async listPeriodBalances(bankAccountId: number, companyId: string, page = 1, limit = 20): Promise<{ data: AccountPeriodBalance[]; total: number }> {
    const offset = (page - 1) * limit
    const { data, error, count } = await supabase
      .from('account_period_balances').select('*', { count: 'exact' })
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .order('period_start', { ascending: false }).range(offset, offset + limit - 1)
    if (error) return { data: [], total: 0 }
    return { data: (data || []) as AccountPeriodBalance[], total: count || 0 }
  }

  async getActivePeriodBalance(bankAccountId: number, companyId: string, onOrBeforeDate: string): Promise<AccountPeriodBalance | null> {
    const { data, error } = await supabase
      .from('account_period_balances').select('*')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .lte('period_start', onOrBeforeDate)
      .order('period_start', { ascending: false }).limit(1).maybeSingle()
    if (error) return null
    return data as AccountPeriodBalance
  }

  async suggestOpeningBalance(bankAccountId: number, companyId: string, periodStart: string): Promise<OpeningBalanceSuggestion> {
    const { data: prevPeriod, error } = await supabase
      .from('account_period_balances').select('*')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .lt('period_start', periodStart)
      .order('period_start', { ascending: false }).limit(1).maybeSingle()

    if (error || !prevPeriod) return { suggested_balance: null, source: 'NO_DATA', prev_period_id: null, prev_period_start: null, prev_period_end: null }

    const { data: txData } = await supabase
      .from('bank_statements').select('credit_amount, debit_amount')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .gte('transaction_date', prevPeriod.period_start).lte('transaction_date', prevPeriod.period_end)
      .is('deleted_at', null)

    const net = (txData || []).reduce((s, r) => s + (r.credit_amount || 0) - (r.debit_amount || 0), 0)
    return {
      suggested_balance: prevPeriod.opening_balance + net,
      source: 'PREV_PERIOD',
      prev_period_id: prevPeriod.id,
      prev_period_start: prevPeriod.period_start,
      prev_period_end: prevPeriod.period_end,
    }
  }

  // ============================================================
  // Payment Method Groups CRUD
  // ============================================================

  async createGroup(dto: CreateGroupDto): Promise<PaymentMethodGroup> {
    try {
      const { data, error } = await supabase
        .from('payment_method_groups')
        .insert({
          company_id: dto.company_id,
          name: dto.name,
          description: dto.description || null,
          color: dto.color || '#6366f1',
          icon: dto.icon || null,
          display_order: dto.display_order ?? 0,
          created_by: dto.created_by || null,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Group "${dto.name}" already exists for this company`)
        }
        throw new DatabaseError('Failed to create payment method group', { cause: error })
      }

      if (dto.payment_method_ids && dto.payment_method_ids.length > 0) {
        await this.replaceGroupMappings(data.id, dto.company_id, dto.payment_method_ids, dto.created_by)
      }

      return this.findGroupById(data.id, dto.company_id) as Promise<PaymentMethodGroup>
    } catch (error) {
      logError('CashFlowSalesRepository.createGroup error', { error })
      throw error
    }
  }

  async updateGroup(id: string, companyId: string, dto: UpdateGroupDto): Promise<PaymentMethodGroup> {
    try {
      const updateData: Record<string, any> = { updated_by: dto.updated_by || null }
      if (dto.name !== undefined) updateData.name = dto.name
      if (dto.description !== undefined) updateData.description = dto.description
      if (dto.color !== undefined) updateData.color = dto.color
      if (dto.icon !== undefined) updateData.icon = dto.icon
      if (dto.display_order !== undefined) updateData.display_order = dto.display_order
      if (dto.is_active !== undefined) updateData.is_active = dto.is_active

      const { error } = await supabase
        .from('payment_method_groups')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', companyId)

      if (error) {
        throw new DatabaseError('Failed to update payment method group', { cause: error })
      }

      if (dto.payment_method_ids !== undefined) {
        await this.replaceGroupMappings(id, companyId, dto.payment_method_ids, dto.updated_by)
      }

      return this.findGroupById(id, companyId) as Promise<PaymentMethodGroup>
    } catch (error) {
      logError('CashFlowSalesRepository.updateGroup error', { id, error })
      throw error
    }
  }

  async deleteGroup(id: string, companyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('payment_method_groups')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)

      if (error) {
        throw new DatabaseError('Failed to delete payment method group', { cause: error })
      }
    } catch (error) {
      logError('CashFlowSalesRepository.deleteGroup error', { id, error })
      throw error
    }
  }

  async findGroupById(id: string, companyId: string): Promise<PaymentMethodGroup | null> {
    const { data, error } = await supabase
      .from('payment_method_groups')
      .select(`
        *,
        mappings:payment_method_group_mappings(*)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !data) return null
    return data as unknown as PaymentMethodGroup
  }

  async listGroups(companyId: string): Promise<PaymentMethodGroup[]> {
    const { data, error } = await supabase
      .from('payment_method_groups')
      .select(`
        *,
        mappings:payment_method_group_mappings(*)
      `)
      .eq('company_id', companyId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      logError('CashFlowSalesRepository.listGroups error', { companyId, error: error.message })
      return []
    }

    return (data || []) as unknown as PaymentMethodGroup[]
  }

  async replaceGroupMappings(
    groupId: string,
    companyId: string,
    paymentMethodIds: number[],
    userId?: string | null
  ): Promise<void> {
    try {
      await supabase
        .from('payment_method_group_mappings')
        .delete()
        .eq('group_id', groupId)

      if (paymentMethodIds.length === 0) return

      const insertData = paymentMethodIds.map((pmId) => ({
        group_id: groupId,
        company_id: companyId,
        payment_method_id: pmId,
        created_by: userId || null,
      }))

      const { error } = await supabase
        .from('payment_method_group_mappings')
        .insert(insertData)

      if (error) {
        if (error.code === '23505') {
          throw new Error('One or more payment methods are already assigned to another group.')
        }
        throw new DatabaseError('Failed to insert group mappings', { cause: error })
      }
    } catch (error) {
      logError('CashFlowSalesRepository.replaceGroupMappings error', { groupId, error })
      throw error
    }
  }

  async reorderGroups(companyId: string, orderedIds: string[]): Promise<void> {
    if (orderedIds.length === 0) return

    // Fetch current versions for optimistic locking
    const { data: currentGroups, error: fetchError } = await supabase
      .from('payment_method_groups')
      .select('id, updated_at')
      .eq('company_id', companyId)
      .in('id', orderedIds)

    if (fetchError) {
      throw new DatabaseError('Failed to fetch current group versions', { cause: new Error(fetchError.message) })
    }

    const versionMap = new Map((currentGroups || []).map(g => [g.id, g.updated_at]))
    const now = new Date().toISOString()

    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('payment_method_groups')
          .update({ display_order: i, updated_at: now })
          .eq('id', id)
          .eq('company_id', companyId)
          .eq('updated_at', versionMap.get(id) || '')
      )
    )

    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      logError('CashFlowSalesRepository.reorderGroups failed', {
        failedCount: failed.length,
        errors: failed.map(f => f.error?.message),
      })
      throw new DatabaseError(
        `Reorder failed: ${failed.length} groups were modified concurrently. Please try again.`,
        { cause: new Error(failed[0].error?.message || 'Concurrent modification detected') }
      )
    }
  }

  // ============================================================
  // Available Payment Types for Mapping UI
  // ============================================================

  async getAvailablePaymentMethods(companyId: string): Promise<AvailablePaymentMethod[]> {
    try {
      const { data: pms, error } = await supabase
        .from('payment_methods')
        .select('id, name, payment_type')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name')

      if (error) {
        logError('CashFlowSalesRepository.getAvailablePaymentMethods: query failed', { companyId, error: error.message })
        throw new DatabaseError('Failed to fetch available payment methods', { cause: error })
      }

      if (!pms || pms.length === 0) return []

      const { data: mappings } = await supabase
        .from('payment_method_group_mappings')
        .select('payment_method_id, group_id, payment_method_groups!inner(id, name)')
        .eq('company_id', companyId)

      const mappingMap = new Map<number, { id: string; name: string }>()
      for (const m of (mappings || []) as any[]) {
        if (m.payment_method_groups) mappingMap.set(m.payment_method_id, m.payment_method_groups)
      }

      return pms.map(pm => {
        const group = mappingMap.get(pm.id)
        return {
          id: pm.id,
          name: pm.name,
          payment_type: pm.payment_type,
          current_group_id: group?.id || null,
          current_group_name: group?.name || null,
        }
      })
    } catch (error) {
      logError('CashFlowSalesRepository.getAvailablePaymentMethods error', { error })
      throw error
    }
  }

  // ============================================================
  // Cash Flow Sales Data
  // ============================================================

  async getSalesBreakdown(
    params: GetCashFlowParams
  ): Promise<{
    groups: SalesGroup[]
    total_income: number
    unreconciled_count: number
  }> {
    try {
      // 1. Get reconciled bank_statements in range to find linked aggregates
      const { data: bsRows, error: bsError } = await supabase
        .from('bank_statements')
        .select('id, reconciliation_id, reconciliation_group_id, cash_deposit_id, is_reconciled, credit_amount')
        .eq('bank_account_id', params.bank_account_id)
        .gte('transaction_date', params.date_from)
        .lte('transaction_date', params.date_to)
        .is('deleted_at', null)

      if (bsError) throw new DatabaseError('Failed to get bank statements for sales', { cause: bsError })

      const allBs = bsRows || []
      const unreconCount = allBs.filter(r => !r.is_reconciled).length

      // Collect all aggregate IDs from all reconciliation paths
      const reconAggIds = allBs.filter(r => r.reconciliation_id).map(r => r.reconciliation_id)

      const multiMatchGroupIds = [...new Set(allBs.filter(r => r.reconciliation_group_id && !r.reconciliation_id).map(r => r.reconciliation_group_id))]
      let multiMatchAggIds: string[] = []
      if (multiMatchGroupIds.length > 0) {
        const { data: groups } = await supabase
          .from('bank_reconciliation_groups')
          .select('aggregate_id')
          .in('id', multiMatchGroupIds)
        multiMatchAggIds = (groups || []).map((g: any) => g.aggregate_id).filter(Boolean)
      }

      const settleStatementIds = allBs
        .filter(r => r.is_reconciled && !r.reconciliation_id && !r.reconciliation_group_id && !r.cash_deposit_id)
        .map(r => String(r.id))
      let settlementAggIds: string[] = []
      if (settleStatementIds.length > 0) {
        const { data: settlements } = await supabase
          .from('bank_settlement_groups')
          .select('bank_settlement_aggregates(aggregate_id)')
          .in('bank_statement_id', settleStatementIds)
          .is('deleted_at', null)
        settlementAggIds = (settlements as any[] || []).flatMap(sg =>
          (sg.bank_settlement_aggregates || []).map((a: any) => a.aggregate_id)
        ).filter(Boolean)
      }

      // 2. Fetch all aggregates at once
      const allAggIds = [...new Set([...reconAggIds, ...multiMatchAggIds, ...settlementAggIds])]

      if (allAggIds.length === 0 ) {
        return { groups: [], total_income: 0, unreconciled_count: unreconCount }
      }

      let aggQuery = supabase
        .from('aggregated_transactions')
        .select('id, branch_id, branch_name, transaction_date, payment_method_id, actual_nett_amount, nett_amount, payment_methods!inner(name, payment_type)')
        .in('id', allAggIds)
        .is('deleted_at', null)

      if (params.branch_id) {
        aggQuery = aggQuery.eq('branch_id', params.branch_id)
      }

      const { data: aggs, error: aggError } = await aggQuery
      if (aggError) throw new DatabaseError('Failed to get aggregates for sales', { cause: aggError })

      // 3. Get group mappings
      const pmIds = [...new Set((aggs || []).map((a: any) => a.payment_method_id).filter(Boolean))]
      const groupLookup = new Map<number, { group_id: string; group_name: string; group_color: string; display_order: number }>()
      if (pmIds.length > 0) {
        const { data: mappings } = await supabase
          .from('payment_method_group_mappings')
          .select('payment_method_id, group_id, payment_method_groups!inner(id, name, color, display_order)')
          .eq('company_id', params.company_id)
          .in('payment_method_id', pmIds)
        for (const m of (mappings || []) as any[]) {
          if (m.payment_method_groups) {
            groupLookup.set(m.payment_method_id, {
              group_id: m.payment_method_groups.id,
              group_name: m.payment_method_groups.name,
              group_color: m.payment_method_groups.color,
              display_order: m.payment_method_groups.display_order ?? 0,
            })
          }
        }
      }

      // 4. Build groups
      type GroupKey = string
      type MethodKey = string
      const groupMap = new Map<GroupKey, {
        group_id: string | null; group_name: string; group_color: string; display_order: number
        items: Map<MethodKey, { payment_type: string; total: number; count: number; branches: Map<string, { name: string; total: number; count: number }> }>
      }>()

      for (const row of (aggs || []) as any[]) {
        const pm = row.payment_methods
        const grp = groupLookup.get(row.payment_method_id)
        const groupKey = grp?.group_id || 'UNGROUPED'
        const amount = Number(row.actual_nett_amount ?? row.nett_amount ?? 0)
        const methodName = pm?.name || 'Lainnya'

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            group_id: grp?.group_id || null,
            group_name: grp?.group_name || 'Lainnya',
            group_color: grp?.group_color || '#9ca3af',
            display_order: grp?.display_order ?? 999,
            items: new Map(),
          })
        }

        const group = groupMap.get(groupKey)!
        if (!group.items.has(methodName)) {
          group.items.set(methodName, { payment_type: pm?.payment_type || 'OTHER', total: 0, count: 0, branches: new Map() })
        }
        const item = group.items.get(methodName)!
        item.total += amount
        item.count++

        const branchKey = row.branch_id || 'unknown'
        if (!item.branches.has(branchKey)) {
          item.branches.set(branchKey, { name: row.branch_name || branchKey, total: 0, count: 0 })
        }
        const branch = item.branches.get(branchKey)!
        branch.total += amount
        branch.count++
      }

      const groups: SalesGroup[] = [...groupMap.values()]
        .sort((a, b) => a.display_order - b.display_order)
        .map(g => {
          const items: SalesBreakdownItem[] = [...g.items.entries()]
            .map(([name, data]) => ({
              payment_method_name: name,
              payment_type: data.payment_type,
              total_amount: data.total,
              transaction_count: data.count,
              branch_breakdown: [...data.branches.entries()].map(([bid, b]) => ({
                branch_id: bid, branch_name: b.name, total_amount: b.total, transaction_count: b.count,
              })).sort((a, b) => b.total_amount - a.total_amount),
            }))
            .sort((a, b) => b.total_amount - a.total_amount)

          return {
            group_id: g.group_id, group_name: g.group_name, group_color: g.group_color, display_order: g.display_order,
            items,
            subtotal: items.reduce((s, i) => s + i.total_amount, 0),
            transaction_count: items.reduce((s, i) => s + i.transaction_count, 0),
          }
        })

      return {
        groups,
        total_income: groups.reduce((s, g) => s + g.subtotal, 0),
        unreconciled_count: unreconCount,
      }
    } catch (error) {
      logError('CashFlowSalesRepository.getSalesBreakdown error', { params, error })
      throw error
    }
  }

  async getRunningBalanceWithSales(
    params: GetCashFlowParams,
    page: number = 1,
    limit: number = 100
  ): Promise<{ rows: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit

      const { data, error, count } = await supabase
        .from('bank_statements')
        .select(`
          id, bank_account_id, company_id, import_id,
          transaction_date, row_number, description,
          credit_amount, debit_amount, balance,
          is_pending, is_reconciled, reference_number, transaction_type,
          reconciliation_id, reconciliation_group_id, cash_deposit_id,
          created_at
        `, { count: 'exact' })
        .eq('bank_account_id', params.bank_account_id)
        .eq('company_id', params.company_id)
        .gte('transaction_date', params.date_from)
        .lte('transaction_date', params.date_to)
        .is('deleted_at', null)
        .order('transaction_date', { ascending: true })
        .order('row_number', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new DatabaseError('Failed to get running balance with sales', { cause: error })
      }

      const rows = data || []

      type EnrichInfo = {
        payment_method_name: string
        payment_type: string
        group_name: string | null
        group_color: string | null
        branch_name: string | null
      }

      // ── Step 1: Collect all IDs from different reconciliation paths ──
      const reconIds = rows.filter(r => r.reconciliation_id).map(r => r.reconciliation_id)
      const groupIds = [...new Set(rows.filter(r => r.reconciliation_group_id && !r.reconciliation_id).map(r => r.reconciliation_group_id))]
      const settleStatementIds = rows
        .filter(r => r.is_reconciled && !r.reconciliation_id && !r.reconciliation_group_id && !r.cash_deposit_id)
        .map(r => String(r.id))
      const cashDepositIds = rows.filter(r => r.cash_deposit_id).map(r => r.cash_deposit_id)

      // ── Step 2: Resolve reconciliation_group_id → aggregate_id & settlement → aggregate_id in parallel ──
      const [reconGroupsResult, settlementsResult, depositsResult] = await Promise.all([
        groupIds.length > 0
          ? supabase.from('bank_reconciliation_groups').select('id, aggregate_id').in('id', groupIds)
          : { data: [] as any[] },
        settleStatementIds.length > 0
          ? supabase.from('bank_settlement_groups').select('bank_statement_id, bank_settlement_aggregates(aggregate_id)').in('bank_statement_id', settleStatementIds).is('deleted_at', null)
          : { data: [] as any[] },
        cashDepositIds.length > 0
          ? supabase.from('cash_deposits').select('id, branch_name, payment_method_id').in('id', cashDepositIds)
          : { data: [] as any[] },
      ])

      const reconGroups = (reconGroupsResult.data || []) as any[]
      const settlements = (settlementsResult.data || []) as any[]
      const deposits = (depositsResult.data || []) as any[]

      const multiMatchAggIds = reconGroups.map(g => g.aggregate_id).filter(Boolean)
      const settlementAggIds = settlements.flatMap(sg =>
        (sg.bank_settlement_aggregates || []).map((a: any) => a.aggregate_id)
      ).filter(Boolean)

      // ── Step 3: Batch ALL aggregated_transactions in ONE query (deduplicated) ──
      const allAggIds = [...new Set([...reconIds, ...multiMatchAggIds, ...settlementAggIds])]
      const { data: allAggs } = allAggIds.length > 0
        ? await supabase
            .from('aggregated_transactions')
            .select('id, branch_name, payment_method_id, payment_methods!inner(name, payment_type)')
            .in('id', allAggIds)
        : { data: [] as any[] }

      // ── Step 4: Batch ALL payment_method_group_mappings in ONE query ──
      const aggPmIds = (allAggs || []).map((a: any) => a.payment_method_id).filter(Boolean)
      const depositPmIds = deposits.map(d => d.payment_method_id).filter(Boolean)
      const allPmIds = [...new Set([...aggPmIds, ...depositPmIds])]

      const [mappingsResult, depositPmsResult] = await Promise.all([
        allPmIds.length > 0
          ? supabase
              .from('payment_method_group_mappings')
              .select('payment_method_id, payment_method_groups!inner(name, color)')
              .eq('company_id', params.company_id)
              .in('payment_method_id', allPmIds)
          : { data: [] as any[] },
        depositPmIds.length > 0
          ? supabase.from('payment_methods').select('id, name').in('id', depositPmIds)
          : { data: [] as any[] },
      ])

      // ── Step 5: Build shared lookup maps ──
      const groupLookup = new Map<number, { name: string; color: string }>()
      for (const m of (mappingsResult.data || []) as any[]) {
        if (m.payment_method_groups) {
          groupLookup.set(m.payment_method_id, {
            name: m.payment_method_groups.name,
            color: m.payment_method_groups.color,
          })
        }
      }

      const buildEnrichInfo = (a: any): EnrichInfo => {
        const pm = a.payment_methods
        const grp = groupLookup.get(a.payment_method_id)
        return {
          payment_method_name: pm?.name || 'Lainnya',
          payment_type: pm?.payment_type || 'OTHER',
          group_name: grp?.name || null,
          group_color: grp?.color || null,
          branch_name: a.branch_name || null,
        }
      }

      // Aggregate lookup (shared across all paths)
      const aggLookup = new Map<string, EnrichInfo>()
      for (const a of (allAggs || []) as any[]) {
        aggLookup.set(String(a.id), buildEnrichInfo(a))
      }

      // 1:1 reconciliation_id → aggregate
      const aggregateMap = new Map<string, EnrichInfo>()
      for (const id of reconIds) {
        const info = aggLookup.get(String(id))
        if (info) aggregateMap.set(String(id), info)
      }

      // Multi-match reconciliation_group_id → aggregate
      const multiMatchMap = new Map<string, EnrichInfo>()
      for (const g of reconGroups) {
        const info = aggLookup.get(String(g.aggregate_id))
        if (info) multiMatchMap.set(String(g.id), info)
      }

      // Settlement → aggregate
      const settlementMap = new Map<string, EnrichInfo>()
      for (const sg of settlements) {
        const firstAggId = sg.bank_settlement_aggregates?.[0]?.aggregate_id
        const info = firstAggId ? aggLookup.get(String(firstAggId)) : null
        if (info) settlementMap.set(String(sg.bank_statement_id), info)
      }

      // Cash deposits — merge PM name + group in one lookup
      const cashDepositMap = new Map<string, EnrichInfo>()
      if (deposits.length > 0) {
        const depositPmLookup = new Map<number, { name: string; group_name: string | null; group_color: string | null }>()
        for (const pm of (depositPmsResult.data || []) as any[]) {
          const grp = groupLookup.get(pm.id)
          depositPmLookup.set(pm.id, {
            name: pm.name,
            group_name: grp?.name || null,
            group_color: grp?.color || null,
          })
        }

        for (const d of deposits) {
          const pm = d.payment_method_id ? depositPmLookup.get(d.payment_method_id) : null
          cashDepositMap.set(String(d.id), {
            payment_method_name: pm?.name || 'Setoran Tunai',
            payment_type: 'CASH',
            group_name: pm?.group_name || null,
            group_color: pm?.group_color || null,
            branch_name: d.branch_name || null,
          })
        }
      }

      // ── Step 6: Enrich rows ──
      const enriched = rows.map((row) => {
        let info: EnrichInfo | null = null

        if (row.reconciliation_id && aggregateMap.has(String(row.reconciliation_id))) {
          info = aggregateMap.get(String(row.reconciliation_id))!
        } else if (row.reconciliation_group_id && multiMatchMap.has(String(row.reconciliation_group_id))) {
          info = multiMatchMap.get(String(row.reconciliation_group_id))!
        } else if (row.cash_deposit_id && cashDepositMap.has(String(row.cash_deposit_id))) {
          info = cashDepositMap.get(String(row.cash_deposit_id))!
        } else if (row.is_reconciled && settlementMap.has(String(row.id))) {
          info = settlementMap.get(String(row.id))!
        }

        return {
          ...row,
          display_description: info
            ? `${info.payment_method_name}${info.branch_name ? ` - ${info.branch_name}` : ''}`
            : row.description,
          payment_method_name: info?.payment_method_name || null,
          payment_type: info?.payment_type || null,
          group_name: info?.group_name || null,
          group_color: info?.group_color || null,
          branch_name: info?.branch_name || null,
          expense_category: null,
        }
      })

      return { rows: enriched, total: count || 0 }
    } catch (error) {
      logError('CashFlowSalesRepository.getRunningBalanceWithSales error', { params, error })
      throw error
    }
  }

  async getBranches(companyId: string): Promise<Array<{ branch_id: string; branch_name: string }>> {
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('branch_name')

    if (error || !data) return []
    return data.map(b => ({ branch_id: b.id, branch_name: b.branch_name }))
  }

  async getCumulativeNetBeforeOffset(
    bankAccountId: number, companyId: string,
    fromDate: string, beforeDate: string, beforeRowNumber: number
  ): Promise<number> {
    const { data: d1 } = await supabase
      .from('bank_statements')
      .select('credit_amount, debit_amount')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .gte('transaction_date', fromDate).lt('transaction_date', beforeDate)
      .is('deleted_at', null)

    const { data: d2 } = await supabase
      .from('bank_statements')
      .select('credit_amount, debit_amount')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .eq('transaction_date', beforeDate).lt('row_number', beforeRowNumber)
      .is('deleted_at', null)

    const all = [...(d1 || []), ...(d2 || [])]
    return all.reduce((s, r) => s + (r.credit_amount || 0) - (r.debit_amount || 0), 0)
  }

  async getCumulativeNetUpToDate(
    bankAccountId: number, companyId: string,
    fromDate: string, toDate: string
  ): Promise<number> {
    const { data } = await supabase
      .from('bank_statements')
      .select('credit_amount, debit_amount')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .gte('transaction_date', fromDate).lte('transaction_date', toDate)
      .is('deleted_at', null)

    return (data || []).reduce((s, r) => s + (r.credit_amount || 0) - (r.debit_amount || 0), 0)
  }

  async getPendingCount(
    bankAccountId: number, companyId: string,
    dateFrom: string, dateTo: string
  ): Promise<{ count: number; estimated_credit: number }> {
    const { data } = await supabase
      .from('bank_statements')
      .select('credit_amount')
      .eq('bank_account_id', bankAccountId).eq('company_id', companyId)
      .gte('transaction_date', dateFrom).lte('transaction_date', dateTo)
      .eq('is_pending', true).is('deleted_at', null)

    const rows = data || []
    return {
      count: rows.length,
      estimated_credit: rows.reduce((s, r) => s + (r.credit_amount || 0), 0),
    }
  }

  // ============================================================
  // Cash Deposits (setoran tunai yang sudah masuk bank)
  // ============================================================

  async getCashDepositBreakdown(
    bankAccountId: number,
    companyId: string,
    dateFrom: string,
    dateTo: string,
    branchId?: string
  ): Promise<Array<{
    deposit_id: string
    deposit_amount: number
    deposit_date: string
    branch_name: string | null
    branch_id: string | null
    payment_method_id: number | null
    payment_method_name: string | null
    group_id: string | null
    group_name: string | null
    group_color: string | null
    group_display_order: number | null
  }>> {
    try {
      // Get bank_statements with cash_deposit_id in range
      let bsQuery = supabase
        .from('bank_statements')
        .select('id, cash_deposit_id, credit_amount, transaction_date')
        .eq('bank_account_id', bankAccountId)
        .eq('company_id', companyId)
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .not('cash_deposit_id', 'is', null)
        .is('deleted_at', null)

      const { data: bsRows, error: bsError } = await bsQuery
      if (bsError) {
        logError('CashFlowSalesRepository.getCashDepositBreakdown: bank statements query failed', { bsError, bankAccountId, companyId })
        throw new DatabaseError('Failed to get bank statements for cash deposits', { cause: bsError })
      }
      if (!bsRows || bsRows.length === 0) return []

      const depositIds = bsRows.map(r => r.cash_deposit_id)

      // Parallel: fetch deposits + all company branches
      const [depositsResult, branchesResult] = await Promise.all([
        supabase
          .from('cash_deposits')
          .select('id, deposit_amount, deposit_date, branch_name, payment_method_id')
          .in('id', depositIds),
        supabase
          .from('branches')
          .select('id, branch_name')
          .eq('company_id', companyId)
          .eq('status', 'active'),
      ])

      if (depositsResult.error) {
        logError('CashFlowSalesRepository.getCashDepositBreakdown: deposits query failed', { error: depositsResult.error.message })
        throw new DatabaseError('Failed to get cash deposits', { cause: depositsResult.error })
      }

      const deposits = depositsResult.data || []
      if (deposits.length === 0) return []

      const branchMap = new Map<string, string>(
        (branchesResult.data || []).map((b: any) => [b.branch_name, b.id])
      )

      // Parallel: fetch payment methods + group mappings
      const pmIds = [...new Set(deposits.map(d => d.payment_method_id).filter(Boolean))] as number[]
      let pmMap = new Map<number, { name: string; group_id: string | null; group_name: string | null; group_color: string | null; group_display_order: number | null }>()
      if (pmIds.length > 0) {
        const [pmsResult, mappingsResult] = await Promise.all([
          supabase.from('payment_methods').select('id, name').in('id', pmIds),
          supabase
            .from('payment_method_group_mappings')
            .select('payment_method_id, group_id, payment_method_groups!inner(id, name, color, display_order)')
            .eq('company_id', companyId)
            .in('payment_method_id', pmIds),
        ])

        for (const pm of (pmsResult.data || []) as any[]) {
          pmMap.set(pm.id, { name: pm.name, group_id: null, group_name: null, group_color: null, group_display_order: null })
        }
        for (const m of (mappingsResult.data || []) as any[]) {
          const existing = pmMap.get(m.payment_method_id)
          if (existing && m.payment_method_groups) {
            existing.group_id = m.payment_method_groups.id
            existing.group_name = m.payment_method_groups.name
            existing.group_color = m.payment_method_groups.color
            existing.group_display_order = m.payment_method_groups.display_order
          }
        }
      }

      let result = deposits.map(d => {
        const pm = d.payment_method_id ? pmMap.get(d.payment_method_id) : null
        const resolvedBranchId = d.branch_name ? (branchMap.get(d.branch_name) || null) : null
        return {
          deposit_id: d.id,
          deposit_amount: Number(d.deposit_amount) || 0,
          deposit_date: d.deposit_date,
          branch_name: d.branch_name || null,
          branch_id: resolvedBranchId,
          payment_method_id: d.payment_method_id || null,
          payment_method_name: pm?.name || 'Setoran Tunai',
          group_id: pm?.group_id || null,
          group_name: pm?.group_name || null,
          group_color: pm?.group_color || null,
          group_display_order: pm?.group_display_order ?? null,
        }
      })

      // Filter by branch if specified
      if (branchId) {
        result = result.filter(r => r.branch_id === branchId)
      }

      return result
    } catch (error) {
      logError('CashFlowSalesRepository.getCashDepositBreakdown error', { error })
      return []
    }
  }
}

export const cashFlowSalesRepository = new CashFlowSalesRepository()
