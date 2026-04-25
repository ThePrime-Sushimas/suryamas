import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import type { FeeDiscrepancyItem, FeeDiscrepancyFilter, FeeDiscrepancySummary, FeeDiscrepancyStatus, FeeDiscrepancySource } from './fee-discrepancy-review.types'

interface ReviewRecord {
  source: string
  source_id: string
  status: string
  correction_journal_id: string | null
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

export class FeeDiscrepancyReviewRepository {

  private async getBranchIdsByCompany(companyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', companyId)

    if (error) {
      logError('getBranchIdsByCompany error', { error: error.message })
      return []
    }
    return (data || []).map((b: { id: string }) => b.id)
  }

  private async getReviewMap(companyId: string): Promise<Record<string, ReviewRecord>> {
    const { data, error } = await supabase
      .from('fee_discrepancy_reviews')
      .select('source, source_id, status, correction_journal_id, notes, reviewed_by, reviewed_at')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (error) {
      logError('getReviewMap error', { error: error.message })
      return {}
    }

    const map: Record<string, ReviewRecord> = {}
    for (const r of data || []) {
      map[`${r.source}_${r.source_id}`] = r as ReviewRecord
    }
    return map
  }

  private applyReview(item: FeeDiscrepancyItem, review: ReviewRecord | undefined): FeeDiscrepancyItem {
    if (!review) return item
    return {
      ...item,
      status: review.status as FeeDiscrepancyStatus,
      correctionJournalId: review.correction_journal_id,
      notes: review.notes || item.notes,
      reviewedBy: review.reviewed_by,
      reviewedAt: review.reviewed_at,
    }
  }

  /** Fetch single discrepancy item by source + sourceId — avoids full table scan */
  async getDiscrepancyById(
    companyId: string,
    source: FeeDiscrepancySource,
    sourceId: string,
  ): Promise<FeeDiscrepancyItem | null> {
    const reviewMap = await this.getReviewMap(companyId)
    const review = reviewMap[`${source}_${sourceId}`]

    if (source === 'SINGLE_MATCH') {
      const branchIds = await this.getBranchIdsByCompany(companyId)
      if (branchIds.length === 0) return null

      const { data, error } = await supabase
        .from('aggregated_transactions')
        .select('id, transaction_date, fee_discrepancy, fee_discrepancy_note, nett_amount, payment_method_id, branch_name, payment_methods(name)')
        .eq('id', sourceId)
        .in('branch_id', branchIds)
        .is('deleted_at', null)
        .single()

      if (error || !data) return null

      const { data: stmts } = await supabase
        .from('bank_statements')
        .select('id, credit_amount, description')
        .eq('reconciliation_id', sourceId)
        .is('deleted_at', null)
        .limit(1)

      const stmt = stmts?.[0]
      const pm = data.payment_methods as unknown as { name: string } | null

      return this.applyReview({
        id: `single_${data.id}`,
        source: 'SINGLE_MATCH',
        sourceId: data.id as string,
        transactionDate: data.transaction_date as string,
        bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null,
        bankAmount: Number(stmt?.credit_amount || 0),
        posNettAmount: Number(data.nett_amount),
        discrepancyAmount: Number(data.fee_discrepancy),
        paymentMethodName: pm?.name || null,
        branchName: data.branch_name as string | null,
        status: 'PENDING',
        correctionJournalId: null,
        reviewedBy: null,
        reviewedAt: null,
        notes: data.fee_discrepancy_note as string | null,
      }, review)
    }

    if (source === 'MULTI_MATCH') {
      const { data, error } = await supabase
        .from('bank_reconciliation_groups')
        .select('id, total_bank_amount, aggregate_amount, difference, aggregated_transactions(transaction_date, nett_amount, branch_name, payment_methods(name))')
        .eq('id', sourceId)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .single()

      if (error || !data) return null

      const { data: stmts } = await supabase
        .from('bank_statements')
        .select('id, credit_amount, description')
        .eq('reconciliation_group_id', sourceId)
        .is('deleted_at', null)
        .limit(1)

      const stmt = stmts?.[0]
      const agg = data.aggregated_transactions as unknown as { transaction_date: string; nett_amount: number; branch_name: string | null; payment_methods: { name: string } | null } | null

      return this.applyReview({
        id: `multi_${data.id}`,
        source: 'MULTI_MATCH',
        sourceId: data.id as string,
        transactionDate: agg?.transaction_date || '',
        bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null,
        bankAmount: Number(data.total_bank_amount),
        posNettAmount: Number(data.aggregate_amount),
        discrepancyAmount: -Number(data.difference),
        paymentMethodName: agg?.payment_methods?.name || null,
        branchName: agg?.branch_name || null,
        status: 'PENDING',
        correctionJournalId: null,
        reviewedBy: null,
        reviewedAt: null,
        notes: null,
      }, review)
    }

    if (source === 'SETTLEMENT_GROUP') {
      const { data, error } = await supabase
        .from('bank_settlement_groups')
        .select('id, bank_statement_id, total_statement_amount, total_allocated_amount, difference, bank_statements(id, transaction_date, description, credit_amount)')
        .eq('id', sourceId)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .single()

      if (error || !data) return null

      const stmt = data.bank_statements as unknown as { id: string; transaction_date: string; description: string | null; credit_amount: number } | null

      return this.applyReview({
        id: `settlement_${data.id}`,
        source: 'SETTLEMENT_GROUP',
        sourceId: data.id as string,
        transactionDate: stmt?.transaction_date || '',
        bankStatementId: data.bank_statement_id as string,
        bankDescription: stmt?.description || null,
        bankAmount: Number(data.total_statement_amount),
        posNettAmount: Number(data.total_allocated_amount),
        discrepancyAmount: -Number(data.difference),
        paymentMethodName: null,
        branchName: null,
        status: 'PENDING',
        correctionJournalId: null,
        reviewedBy: null,
        reviewedAt: null,
        notes: null,
      }, review)
    }

    return null
  }

  async getDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<{ data: FeeDiscrepancyItem[]; total: number }> {
    const limit = filter.limit || 50
    const offset = ((filter.page || 1) - 1) * limit

    const reviewMap = await this.getReviewMap(companyId)

    const [singleItems, multiItems, settlementItems] = await Promise.all([
      this.getSingleMatchDiscrepancies(companyId, filter),
      this.getMultiMatchDiscrepancies(companyId, filter),
      this.getSettlementDiscrepancies(companyId, filter),
    ])

    const items = [...singleItems, ...multiItems, ...settlementItems].map(item =>
      this.applyReview(item, reviewMap[`${item.source}_${item.sourceId}`])
    )

    items.sort((a, b) => {
      const dateDiff = b.transactionDate.localeCompare(a.transactionDate)
      if (dateDiff !== 0) return dateDiff
      return Math.abs(b.discrepancyAmount) - Math.abs(a.discrepancyAmount)
    })

    const filtered = filter.status ? items.filter(i => i.status === filter.status) : items
    const amountFiltered = filter.minAmount ? filtered.filter(i => Math.abs(i.discrepancyAmount) >= filter.minAmount!) : filtered

    return { data: amountFiltered.slice(offset, offset + limit), total: amountFiltered.length }
  }

  async getSummary(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancySummary> {
    const { data } = await this.getDiscrepancies(companyId, { ...filter, page: 1, limit: 10000 })

    const summary: FeeDiscrepancySummary = {
      totalPending: 0, totalConfirmed: 0, totalCorrected: 0, totalDismissed: 0,
      sumPendingPositive: 0, sumPendingNegative: 0, count: data.length,
    }

    for (const item of data) {
      switch (item.status) {
        case 'PENDING':
          summary.totalPending++
          if (item.discrepancyAmount > 0) summary.sumPendingPositive += item.discrepancyAmount
          else summary.sumPendingNegative += item.discrepancyAmount
          break
        case 'CONFIRMED': summary.totalConfirmed++; break
        case 'CORRECTED': summary.totalCorrected++; break
        case 'DISMISSED': summary.totalDismissed++; break
      }
    }
    return summary
  }

  async updateStatus(
    companyId: string,
    source: FeeDiscrepancySource,
    sourceId: string,
    status: FeeDiscrepancyStatus,
    userId: string,
    notes?: string,
    correctionJournalId?: string,
  ): Promise<void> {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('fee_discrepancy_reviews')
      .upsert({
        source,
        source_id: sourceId,
        company_id: companyId,
        status,
        notes: notes || null,
        correction_journal_id: correctionJournalId || null,
        reviewed_by: userId,
        reviewed_at: now,
        updated_at: now,
      }, { onConflict: 'source,source_id,company_id' })

    if (error) {
      logError('updateStatus error', { error: error.message, source, sourceId })
      throw new Error(error.message)
    }

    logInfo('Fee discrepancy status updated', { source, sourceId, status })
  }

  // ── Data source queries ──

  private async getSingleMatchDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const branchIds = await this.getBranchIdsByCompany(companyId)
    if (branchIds.length === 0) return []

    let query = supabase
      .from('aggregated_transactions')
      .select('id, transaction_date, fee_discrepancy, fee_discrepancy_note, nett_amount, actual_nett_amount, payment_method_id, branch_name, payment_methods(name)')
      .in('branch_id', branchIds)
      .eq('is_reconciled', true)
      .neq('fee_discrepancy', 0)
      .is('deleted_at', null)

    if (filter.dateFrom) query = query.gte('transaction_date', filter.dateFrom)
    if (filter.dateTo) query = query.lte('transaction_date', filter.dateTo)
    if (filter.paymentMethodId) query = query.eq('payment_method_id', filter.paymentMethodId)

    const { data, error } = await query
    if (error) { logError('getSingleMatchDiscrepancies error', { error: error.message }); return [] }

    const aggIds = (data || []).map((r: { id: string }) => r.id)
    let stmtMap: Record<string, { id: string; credit_amount: number; description: string | null }> = {}
    if (aggIds.length > 0) {
      const { data: stmts } = await supabase
        .from('bank_statements')
        .select('id, reconciliation_id, credit_amount, description')
        .in('reconciliation_id', aggIds)
        .is('deleted_at', null)
      for (const s of stmts || []) stmtMap[s.reconciliation_id as string] = s as { id: string; credit_amount: number; description: string | null }
    }

    return (data || []).map((row: Record<string, unknown>) => {
      const stmt = stmtMap[row.id as string]
      const pm = row.payment_methods as { name: string } | null
      return {
        id: `single_${row.id}`,
        source: 'SINGLE_MATCH' as const,
        sourceId: row.id as string,
        transactionDate: row.transaction_date as string,
        bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null,
        bankAmount: Number(stmt?.credit_amount || 0),
        posNettAmount: Number(row.nett_amount),
        discrepancyAmount: Number(row.fee_discrepancy),
        paymentMethodName: pm?.name || null,
        branchName: row.branch_name as string | null,
        status: 'PENDING' as FeeDiscrepancyStatus,
        correctionJournalId: null,
        reviewedBy: null,
        reviewedAt: null,
        notes: row.fee_discrepancy_note as string | null,
      }
    })
  }

  private async getMultiMatchDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const query = supabase
      .from('bank_reconciliation_groups')
      .select('id, aggregate_id, total_bank_amount, aggregate_amount, difference, aggregated_transactions(transaction_date, nett_amount, payment_method_id, branch_name, payment_methods(name))')
      .eq('company_id', companyId)
      .neq('difference', 0)
      .is('deleted_at', null)

    const { data, error } = await query
    if (error) { logError('getMultiMatchDiscrepancies error', { error: error.message }); return [] }

    const groupIds = (data || []).map((r: { id: string }) => r.id)
    let stmtMap: Record<string, { id: string; credit_amount: number; description: string | null }> = {}
    if (groupIds.length > 0) {
      const { data: stmts } = await supabase
        .from('bank_statements')
        .select('id, reconciliation_group_id, credit_amount, description')
        .in('reconciliation_group_id', groupIds)
        .is('deleted_at', null)
      for (const s of stmts || []) {
        if (!stmtMap[s.reconciliation_group_id as string]) stmtMap[s.reconciliation_group_id as string] = s as { id: string; credit_amount: number; description: string | null }
      }
    }

    return (data || [])
      .filter((row: Record<string, unknown>) => {
        const agg = row.aggregated_transactions as { transaction_date: string } | null
        const txDate = agg?.transaction_date
        if (filter.dateFrom && txDate && txDate < filter.dateFrom) return false
        if (filter.dateTo && txDate && txDate > filter.dateTo) return false
        return true
      })
      .map((row: Record<string, unknown>) => {
        const agg = row.aggregated_transactions as { transaction_date: string; nett_amount: number; branch_name: string | null; payment_methods: { name: string } | null } | null
        const stmt = stmtMap[row.id as string]
        return {
          id: `multi_${row.id}`,
          source: 'MULTI_MATCH' as const,
          sourceId: row.id as string,
          transactionDate: agg?.transaction_date || '',
          bankStatementId: stmt?.id || '',
          bankDescription: stmt?.description || null,
          bankAmount: Number(row.total_bank_amount),
          posNettAmount: Number(row.aggregate_amount),
          discrepancyAmount: -Number(row.difference),
          paymentMethodName: agg?.payment_methods?.name || null,
          branchName: agg?.branch_name || null,
          status: 'PENDING' as FeeDiscrepancyStatus,
          correctionJournalId: null,
          reviewedBy: null,
          reviewedAt: null,
          notes: null,
        }
      })
  }

  private async getSettlementDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const query = supabase
      .from('bank_settlement_groups')
      .select('id, bank_statement_id, total_statement_amount, total_allocated_amount, difference, bank_statements(id, transaction_date, description, credit_amount), bank_settlement_aggregates(aggregate_id)')
      .eq('company_id', companyId)
      .neq('difference', 0)
      .is('deleted_at', null)

    const { data, error } = await query
    if (error) { logError('getSettlementDiscrepancies error', { error: error.message }); return [] }

    const allAggIds = (data || []).flatMap((row: Record<string, unknown>) =>
      ((row.bank_settlement_aggregates as { aggregate_id: string }[]) || []).map(a => a.aggregate_id)
    )
    let aggDetailsMap: Record<string, { branch_name: string | null; pm_name: string | null }> = {}
    if (allAggIds.length > 0) {
      const { data: aggs } = await supabase
        .from('aggregated_transactions')
        .select('id, branch_name, payment_methods(name)')
        .in('id', allAggIds)
      for (const a of aggs || []) {
        aggDetailsMap[a.id as string] = {
          branch_name: a.branch_name as string | null,
          pm_name: (a.payment_methods as unknown as { name: string } | null)?.name || null,
        }
      }
    }

    return (data || [])
      .filter((row: Record<string, unknown>) => {
        const stmt = row.bank_statements as { transaction_date: string } | null
        const txDate = stmt?.transaction_date
        if (filter.dateFrom && txDate && txDate < filter.dateFrom) return false
        if (filter.dateTo && txDate && txDate > filter.dateTo) return false
        return true
      })
      .map((row: Record<string, unknown>) => {
        const stmt = row.bank_statements as { id: string; transaction_date: string; description: string | null; credit_amount: number } | null
        const settleAggs = (row.bank_settlement_aggregates as { aggregate_id: string }[]) || []
        const pmNames = [...new Set(settleAggs.map(a => aggDetailsMap[a.aggregate_id]?.pm_name).filter(Boolean))]
        const branchNames = [...new Set(settleAggs.map(a => aggDetailsMap[a.aggregate_id]?.branch_name).filter(Boolean))]

        return {
          id: `settlement_${row.id}`,
          source: 'SETTLEMENT_GROUP' as const,
          sourceId: row.id as string,
          transactionDate: stmt?.transaction_date || '',
          bankStatementId: row.bank_statement_id as string,
          bankDescription: stmt?.description || null,
          bankAmount: Number(row.total_statement_amount),
          posNettAmount: Number(row.total_allocated_amount),
          discrepancyAmount: -Number(row.difference),
          paymentMethodName: pmNames.join(', ') || null,
          branchName: branchNames.join(', ') || null,
          status: 'PENDING' as FeeDiscrepancyStatus,
          correctionJournalId: null,
          reviewedBy: null,
          reviewedAt: null,
          notes: null,
        }
      })
  }
}

export const feeDiscrepancyReviewRepository = new FeeDiscrepancyReviewRepository()
