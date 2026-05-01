import { logInfo, logError } from '../../config/logger'
import { cashFlowSalesRepository } from './cash-flow-sales.repository'
import { AuditService } from '../monitoring/monitoring.service'
import {
  PeriodNotFoundError,
  PeriodAlreadyExistsError,
  InvalidPeriodDatesError,
  GroupNotFoundError,
  BankAccountNotFoundError,
} from './cash-flow.errors'
import type {
  PaymentMethodGroup,
  CreateGroupDto,
  UpdateGroupDto,
  AvailablePaymentMethod,
  RunningBalanceRow,
  CashFlowSummary,
  CashFlowDailyResult,
  GetCashFlowParams,
  AccountPeriodBalance,
  CreatePeriodBalanceDto,
  UpdatePeriodBalanceDto,
  OpeningBalanceSuggestion,
} from './cash-flow-sales.types'

export class CashFlowSalesService {

  // ============================================================
  // Period Balance Management
  // ============================================================

  async createPeriodBalance(dto: CreatePeriodBalanceDto, companyId: string, userId?: string): Promise<AccountPeriodBalance> {
    if (new Date(dto.period_start) > new Date(dto.period_end)) throw new InvalidPeriodDatesError(dto.period_start, dto.period_end)

    const existing = await cashFlowSalesRepository.getActivePeriodBalance(dto.bank_account_id, companyId, dto.period_start)
    if (existing && existing.period_start === dto.period_start) throw new PeriodAlreadyExistsError(dto.period_start)

    if (dto.source === 'AUTO_PREV_PERIOD') {
      const suggestion = await cashFlowSalesRepository.suggestOpeningBalance(dto.bank_account_id, companyId, dto.period_start)
      if (suggestion.source === 'NO_DATA') throw new PeriodNotFoundError('previous')
      dto.opening_balance = suggestion.suggested_balance!
      dto.previous_period_id = suggestion.prev_period_id
    }

    const result = await cashFlowSalesRepository.createPeriodBalance({ ...dto, company_id: companyId, created_by: userId })
    await AuditService.log('CREATE', 'cash_flow_period', result.id, userId || null, undefined, result)
    return result
  }

  async updatePeriodBalance(id: string, companyId: string, dto: UpdatePeriodBalanceDto, userId?: string): Promise<AccountPeriodBalance> {
    const existing = await cashFlowSalesRepository.findPeriodBalanceById(id, companyId)
    if (!existing) throw new PeriodNotFoundError(id)

    const effectiveStart = dto.period_start || existing.period_start
    const effectiveEnd = dto.period_end || existing.period_end
    if (effectiveEnd < effectiveStart) throw new InvalidPeriodDatesError(effectiveStart, effectiveEnd)

    const result = await cashFlowSalesRepository.updatePeriodBalance(id, companyId, { ...dto, updated_by: userId })
    await AuditService.log('UPDATE', 'cash_flow_period', id, userId || null, existing, result)
    return result
  }

  async deletePeriodBalance(id: string, companyId: string, userId?: string): Promise<void> {
    const existing = await cashFlowSalesRepository.findPeriodBalanceById(id, companyId)
    if (!existing) throw new PeriodNotFoundError(id)
    await cashFlowSalesRepository.deletePeriodBalance(id, companyId)
    await AuditService.log('DELETE', 'cash_flow_period', id, userId || null, existing)
  }

  async listPeriodBalances(bankAccountId: number, companyId: string, page = 1, limit = 20) {
    const { data, total } = await cashFlowSalesRepository.listPeriodBalances(bankAccountId, companyId, page, limit)
    const totalPages = Math.ceil(total / limit)
    return { data, pagination: { total, page, limit, total_pages: totalPages, has_next: page < totalPages, has_prev: page > 1 } }
  }

  async getSuggestion(bankAccountId: number, companyId: string, periodStart: string): Promise<OpeningBalanceSuggestion> {
    return cashFlowSalesRepository.suggestOpeningBalance(bankAccountId, companyId, periodStart)
  }

  // ============================================================
  // Payment Method Groups Management
  // ============================================================

  async listGroups(companyId: string): Promise<{
    groups: PaymentMethodGroup[]
    available_payment_methods: AvailablePaymentMethod[]
  }> {
    const [groups, availableMethods] = await Promise.all([
      cashFlowSalesRepository.listGroups(companyId),
      cashFlowSalesRepository.getAvailablePaymentMethods(companyId),
    ])
    return { groups, available_payment_methods: availableMethods }
  }

  async createGroup(dto: CreateGroupDto, userId?: string): Promise<PaymentMethodGroup> {
    logInfo('CashFlowSalesService.createGroup', { company_id: dto.company_id, name: dto.name })

    const result = await cashFlowSalesRepository.createGroup({
      ...dto,
      created_by: userId,
    })

    await AuditService.log('CREATE', 'payment_method_group', result.id, userId || null, undefined, result)
    return result
  }

  async updateGroup(
    id: string,
    companyId: string,
    dto: UpdateGroupDto,
    userId?: string
  ): Promise<PaymentMethodGroup> {
    logInfo('CashFlowSalesService.updateGroup', { id, dto })

    const existing = await cashFlowSalesRepository.findGroupById(id, companyId)
    if (!existing) throw new GroupNotFoundError(id)

    const result = await cashFlowSalesRepository.updateGroup(id, companyId, {
      ...dto,
      updated_by: userId,
    })

    await AuditService.log('UPDATE', 'payment_method_group', id, userId || null, existing, result)
    return result
  }

  async deleteGroup(id: string, companyId: string, userId?: string): Promise<void> {
    const existing = await cashFlowSalesRepository.findGroupById(id, companyId)
    if (!existing) throw new GroupNotFoundError(id)

    await cashFlowSalesRepository.deleteGroup(id, companyId)
    await AuditService.log('DELETE', 'payment_method_group', id, userId || null, existing)
  }

  async reorderGroups(companyId: string, orderedIds: string[]): Promise<void> {
    await cashFlowSalesRepository.reorderGroups(companyId, orderedIds)
  }

  // ============================================================
  // Cash Flow Daily (Running Balance + Sales Breakdown)
  // ============================================================

  async getCashFlowDaily(
    params: GetCashFlowParams,
    page: number = 1,
    limit: number = 100
  ): Promise<CashFlowDailyResult> {
    logInfo('CashFlowSalesService.getCashFlowDaily', { params, page, limit })

    const bankAccount = await cashFlowSalesRepository.getBankAccountInfo(
      params.bank_account_id,
      params.company_id
    )
    if (!bankAccount) {
      throw new BankAccountNotFoundError(params.bank_account_id)
    }

    const period = await cashFlowSalesRepository.getActivePeriodBalance(
      params.bank_account_id,
      params.company_id,
      params.date_from
    )

    // No period = return empty result so frontend can show setup UI
    if (!period) {
      return {
        period: null,
        bank_account: bankAccount,
        summary: {
          opening_balance: 0, total_income: 0, income_by_group: [],
          total_expense: 0, expense_by_category: [], closing_balance: 0, net_change: 0,
          pending_count: 0, pending_income_estimate: 0, pending_expense_estimate: 0, unreconciled_count: 0,
          unreconciled_credit_count: 0, unreconciled_credit_amount: 0, unreconciled_debit_count: 0, unreconciled_debit_amount: 0,
        },
        rows: [],
        pagination: { page, limit, total: 0, total_pages: 0, has_next: false, has_prev: false },
      }
    }

    const [salesResult, cashDeposits, { rows: rawRows, total }, pendingInfo, periodTotals, expenseBreakdown] = await Promise.all([
      cashFlowSalesRepository.getSalesBreakdown(params),
      cashFlowSalesRepository.getCashDepositBreakdown(
        params.bank_account_id, params.company_id,
        params.date_from, params.date_to, params.branch_id
      ),
      cashFlowSalesRepository.getRunningBalanceWithSales(params, page, limit),
      cashFlowSalesRepository.getPendingCount(
        params.bank_account_id, params.company_id,
        params.date_from, params.date_to
      ),
      cashFlowSalesRepository.getPeriodTotals(
        params.bank_account_id, params.company_id,
        params.date_from, params.date_to
      ),
      cashFlowSalesRepository.getExpenseBreakdown(
        params.bank_account_id, params.company_id,
        params.date_from, params.date_to
      ),
    ])

    // Merge cash deposits into sales groups
    const mergedGroups = this.mergeCashDepositsIntoGroups(salesResult.groups, cashDeposits)

    let cumulativeNetBeforePage = 0
    if (page > 1 && rawRows.length > 0) {
      const firstRow = rawRows[0]
      cumulativeNetBeforePage = await cashFlowSalesRepository.getCumulativeNetBeforeOffset(
        params.bank_account_id, params.company_id,
        period.period_start, firstRow.transaction_date, firstRow.row_number
      )
    } else if (page === 1 && period.period_start < params.date_from) {
      const dayBefore = this.subtractOneDay(params.date_from)
      cumulativeNetBeforePage = await cashFlowSalesRepository.getCumulativeNetUpToDate(
        params.bank_account_id, params.company_id,
        period.period_start, dayBefore
      )
    }

    let runningCumulative = cumulativeNetBeforePage
    const rows: RunningBalanceRow[] = rawRows.map((row) => {
      runningCumulative += (row.credit_amount || 0) - (row.debit_amount || 0)
      return {
        id: row.id,
        bank_account_id: row.bank_account_id,
        company_id: row.company_id,
        transaction_date: row.transaction_date,
        row_number: row.row_number,
        description: row.display_description || row.description,
        credit_amount: row.credit_amount || 0,
        debit_amount: row.debit_amount || 0,
        bank_balance: row.balance ?? null,
        running_balance: period.opening_balance + runningCumulative,
        is_pending: row.is_pending || false,
        is_reconciled: row.is_reconciled || false,
        payment_method_name: row.payment_method_name || null,
        payment_type: row.payment_type || null,
        group_name: row.group_name || null,
        group_color: row.group_color || null,
        branch_name: row.branch_name || null,
        expense_category: null,
        purpose_id: null,
        purpose_name: null,
      }
    })

    const totalExpense = periodTotals.total_debit

    const totalIncome = mergedGroups.reduce((s, g) => s + g.subtotal, 0)

    const summary: CashFlowSummary = {
      opening_balance: period.opening_balance,
      total_income: totalIncome,
      income_by_group: mergedGroups,
      total_expense: totalExpense,
      expense_by_category: expenseBreakdown,
      closing_balance: period.opening_balance + totalIncome - totalExpense,
      net_change: totalIncome - totalExpense,
      pending_count: pendingInfo.count,
      pending_income_estimate: pendingInfo.estimated_credit,
      pending_expense_estimate: pendingInfo.estimated_debit,
      unreconciled_count: salesResult.unreconciled_count,
      unreconciled_credit_count: salesResult.unreconciled_credit_count,
      unreconciled_credit_amount: salesResult.unreconciled_credit_amount,
      unreconciled_debit_count: salesResult.unreconciled_debit_count,
      unreconciled_debit_amount: salesResult.unreconciled_debit_amount,
    }

    const totalPages = Math.ceil(total / limit)

    return {
      period,
      bank_account: bankAccount,
      summary,
      rows,
      pagination: {
        page, limit, total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    }
  }

  async getBranches(companyId: string) {
    return cashFlowSalesRepository.getBranches(companyId)
  }

  private subtractOneDay(dateStr: string): string {
    const d = new Date(dateStr)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  private mergeCashDepositsIntoGroups(
    groups: import('./cash-flow-sales.types').SalesGroup[],
    cashDeposits: Array<{
      deposit_amount: number
      branch_name: string | null
      branch_id: string | null
      payment_method_name: string | null
      group_id: string | null
      group_name: string | null
      group_color: string | null
      group_display_order: number | null
    }>
  ): import('./cash-flow-sales.types').SalesGroup[] {
    if (cashDeposits.length === 0) return groups

    // Clone groups
    const merged = groups.map(g => ({
      ...g,
      items: g.items.map(i => ({ ...i })),
    }))

    for (const dep of cashDeposits) {
      const groupKey = dep.group_id || 'UNGROUPED'
      const pmName = dep.payment_method_name || 'Setoran Tunai'

      let group = merged.find(g => (g.group_id || 'UNGROUPED') === groupKey)
      if (!group) {
        group = {
          group_id: dep.group_id,
          group_name: dep.group_name || 'Lainnya',
          group_color: dep.group_color || '#9ca3af',
          display_order: dep.group_display_order ?? 999,
          items: [],
          subtotal: 0,
          transaction_count: 0,
        }
        merged.push(group)
      }

      let item = group.items.find(i => i.payment_method_name === pmName)
      if (!item) {
        item = {
          payment_method_name: pmName,
          payment_type: 'CASH',
          total_amount: 0,
          transaction_count: 0,
        }
        group.items.push(item)
      }

      item.total_amount += dep.deposit_amount
      item.transaction_count++
      group.subtotal += dep.deposit_amount
      group.transaction_count++
    }

    // Re-sort
    merged.sort((a, b) => a.display_order - b.display_order)
    for (const g of merged) {
      g.items.sort((a, b) => b.total_amount - a.total_amount)
    }

    return merged
  }
}

export const cashFlowSalesService = new CashFlowSalesService()
