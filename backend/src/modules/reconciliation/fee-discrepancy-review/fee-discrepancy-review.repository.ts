import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import type { FeeDiscrepancyItem, FeeDiscrepancyFilter, FeeDiscrepancySummary } from './fee-discrepancy-review.types'

export class FeeDiscrepancyReviewRepository {

  /** Fetch all branch IDs for a company (cached per request) */
  private async getBranchIdsByCompany(companyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (error) {
      logError('getBranchIdsByCompany error', { error: error.message })
      return []
    }
    return (data || []).map((b: { id: string }) => b.id)
  }

  async getDiscrepancies(
    companyId: string,
    filter: FeeDiscrepancyFilter
  ): Promise<{ data: FeeDiscrepancyItem[]; total: number }> {
    const limit = filter.limit || 50
    const offset = ((filter.page || 1) - 1) * limit
    const items: FeeDiscrepancyItem[] = []

    // 1. Single match: aggregated_transactions with fee_discrepancy != 0
    const singleItems = await this.getSingleMatchDiscrepancies(companyId, filter)

    // 2. Multi-match: bank_reconciliation_groups with difference != 0
    const multiItems = await this.getMultiMatchDiscrepancies(companyId, filter)

    // 3. Settlement groups: bank_settlement_groups with difference != 0
    const settlementItems = await this.getSettlementDiscrepancies(companyId, filter)

    items.push(...singleItems, ...multiItems, ...settlementItems)

    // Sort by date desc, then abs(amount) desc
    items.sort((a, b) => {
      const dateDiff = b.transactionDate.localeCompare(a.transactionDate)
      if (dateDiff !== 0) return dateDiff
      return Math.abs(b.discrepancyAmount) - Math.abs(a.discrepancyAmount)
    })

    // Filter by status
    const filtered = filter.status
      ? items.filter(i => i.status === filter.status)
      : items

    // Filter by min amount
    const amountFiltered = filter.minAmount
      ? filtered.filter(i => Math.abs(i.discrepancyAmount) >= filter.minAmount!)
      : filtered

    const total = amountFiltered.length
    const paged = amountFiltered.slice(offset, offset + limit)

    return { data: paged, total }
  }

  async getSummary(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancySummary> {
    const { data } = await this.getDiscrepancies(companyId, { ...filter, page: 1, limit: 10000 })

    let totalPending = 0, totalConfirmed = 0, totalCorrected = 0
    let sumPendingPositive = 0, sumPendingNegative = 0

    for (const item of data) {
      if (item.status === 'PENDING') {
        totalPending++
        if (item.discrepancyAmount > 0) sumPendingPositive += item.discrepancyAmount
        else sumPendingNegative += item.discrepancyAmount
      } else if (item.status === 'CONFIRMED') {
        totalConfirmed++
      } else if (item.status === 'CORRECTED') {
        totalCorrected++
      }
    }

    return { totalPending, totalConfirmed, totalCorrected, sumPendingPositive, sumPendingNegative, count: data.length }
  }

  private async getSingleMatchDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const branchIds = await this.getBranchIdsByCompany(companyId)
    if (branchIds.length === 0) return []

    let query = supabase
      .from('aggregated_transactions')
      .select(`
        id, transaction_date, fee_discrepancy, fee_discrepancy_note,
        nett_amount, actual_nett_amount, payment_method_id, branch_name,
        payment_methods ( name )
      `)
      .in('branch_id', branchIds)
      .eq('is_reconciled', true)
      .neq('fee_discrepancy', 0)
      .is('deleted_at', null)

    if (filter.dateFrom) query = query.gte('transaction_date', filter.dateFrom)
    if (filter.dateTo) query = query.lte('transaction_date', filter.dateTo)
    if (filter.paymentMethodId) query = query.eq('payment_method_id', filter.paymentMethodId)

    const { data, error } = await query
    if (error) {
      logError('getSingleMatchDiscrepancies error', { error: error.message })
      return []
    }

    // Get linked bank statements
    const aggIds = (data || []).map((r: any) => r.id)
    let stmtMap: Record<string, any> = {}
    if (aggIds.length > 0) {
      const { data: stmts } = await supabase
        .from('bank_statements')
        .select('id, reconciliation_id, credit_amount, description')
        .in('reconciliation_id', aggIds)
        .is('deleted_at', null)
      for (const s of stmts || []) {
        stmtMap[s.reconciliation_id as string] = s
      }
    }

    return (data || []).map((row: any) => {
      const stmt = stmtMap[row.id]
      return {
        id: `single_${row.id}`,
        source: 'SINGLE_MATCH' as const,
        sourceId: row.id,
        transactionDate: row.transaction_date,
        bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null,
        bankAmount: Number(stmt?.credit_amount || 0),
        posNettAmount: Number(row.nett_amount),
        discrepancyAmount: Number(row.fee_discrepancy),
        paymentMethodName: row.payment_methods?.name || null,
        branchName: row.branch_name,
        status: 'PENDING' as const,
        correctionJournalId: null,
        notes: row.fee_discrepancy_note,
      }
    })
  }

  private async getMultiMatchDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    let query = supabase
      .from('bank_reconciliation_groups')
      .select(`
        id, aggregate_id, total_bank_amount, aggregate_amount, difference,
        aggregated_transactions ( transaction_date, nett_amount, payment_method_id, branch_name, payment_methods ( name ) )
      `)
      .eq('company_id', companyId)
      .neq('difference', 0)
      .is('deleted_at', null)

    const { data, error } = await query
    if (error) {
      logError('getMultiMatchDiscrepancies error', { error: error.message })
      return []
    }

    // Get linked bank statements
    const groupIds = (data || []).map((r: any) => r.id)
    let stmtMap: Record<string, any> = {}
    if (groupIds.length > 0) {
      const { data: stmts } = await supabase
        .from('bank_statements')
        .select('id, reconciliation_group_id, credit_amount, description')
        .in('reconciliation_group_id', groupIds)
        .is('deleted_at', null)
      for (const s of stmts || []) {
        if (!stmtMap[s.reconciliation_group_id as string]) stmtMap[s.reconciliation_group_id as string] = s
      }
    }

    return (data || [])
      .filter((row: any) => {
        const txDate = row.aggregated_transactions?.transaction_date
        if (filter.dateFrom && txDate < filter.dateFrom) return false
        if (filter.dateTo && txDate > filter.dateTo) return false
        return true
      })
      .map((row: any) => {
        const agg = row.aggregated_transactions
        const stmt = stmtMap[row.id]
        return {
          id: `multi_${row.id}`,
          source: 'MULTI_MATCH' as const,
          sourceId: row.id,
          transactionDate: agg?.transaction_date || '',
          bankStatementId: stmt?.id || '',
          bankDescription: stmt?.description || null,
          bankAmount: Number(row.total_bank_amount),
          posNettAmount: Number(row.aggregate_amount),
          discrepancyAmount: -Number(row.difference), // negate: positive diff = bank lebih = negative fee disc
          paymentMethodName: agg?.payment_methods?.name || null,
          branchName: agg?.branch_name || null,
          status: 'PENDING' as const,
          correctionJournalId: null,
          notes: null,
        }
      })
  }

  private async getSettlementDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    let query = supabase
      .from('bank_settlement_groups')
      .select(`
        id, bank_statement_id, total_statement_amount, total_allocated_amount, difference,
        bank_statements ( id, transaction_date, description, credit_amount )
      `)
      .eq('company_id', companyId)
      .neq('difference', 0)
      .is('deleted_at', null)

    const { data, error } = await query
    if (error) {
      logError('getSettlementDiscrepancies error', { error: error.message })
      return []
    }

    return (data || [])
      .filter((row: any) => {
        const txDate = (row.bank_statements as any)?.transaction_date
        if (filter.dateFrom && txDate < filter.dateFrom) return false
        if (filter.dateTo && txDate > filter.dateTo) return false
        return true
      })
      .map((row: any) => {
        const stmt = row.bank_statements as any
        return {
          id: `settlement_${row.id}`,
          source: 'SETTLEMENT_GROUP' as const,
          sourceId: row.id,
          transactionDate: stmt?.transaction_date || '',
          bankStatementId: row.bank_statement_id,
          bankDescription: stmt?.description || null,
          bankAmount: Number(row.total_statement_amount),
          posNettAmount: Number(row.total_allocated_amount),
          discrepancyAmount: -Number(row.difference), // negate: positive diff = bank lebih
          paymentMethodName: null,
          branchName: null,
          status: 'PENDING' as const,
          correctionJournalId: null,
          notes: null,
        }
      })
  }
}

export const feeDiscrepancyReviewRepository = new FeeDiscrepancyReviewRepository()
