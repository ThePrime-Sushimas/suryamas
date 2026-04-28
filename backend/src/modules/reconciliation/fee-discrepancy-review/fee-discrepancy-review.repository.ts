import { pool } from '@/config/db'
import { logInfo, logError } from '@/config/logger'
import type { FeeDiscrepancyItem, FeeDiscrepancyFilter, FeeDiscrepancySummary, FeeDiscrepancyStatus, FeeDiscrepancySource } from './fee-discrepancy-review.types'

interface ReviewRecord {
  source: string; source_id: string; status: string;
  correction_journal_id: string | null; notes: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
}

export class FeeDiscrepancyReviewRepository {

  private async getBranchIdsByCompany(companyId: string): Promise<string[]> {
    const { rows } = await pool.query(`SELECT id FROM branches WHERE company_id = $1`, [companyId])
    return rows.map(b => b.id)
  }

  private async getReviewMap(companyId: string): Promise<Record<string, ReviewRecord>> {
    const { rows } = await pool.query(
      `SELECT source, source_id, status, correction_journal_id, notes, reviewed_by, reviewed_at
       FROM fee_discrepancy_reviews WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    )
    const map: Record<string, ReviewRecord> = {}
    for (const r of rows) map[`${r.source}_${r.source_id}`] = r
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

  async getDiscrepancyById(companyId: string, source: FeeDiscrepancySource, sourceId: string): Promise<FeeDiscrepancyItem | null> {
    const reviewMap = await this.getReviewMap(companyId)
    const review = reviewMap[`${source}_${sourceId}`]

    if (source === 'SINGLE_MATCH') {
      const branchIds = await this.getBranchIdsByCompany(companyId)
      if (branchIds.length === 0) return null

      const { rows } = await pool.query(
        `SELECT at.id, at.transaction_date, at.fee_discrepancy, at.fee_discrepancy_note,
                at.nett_amount, at.payment_method_id, at.branch_name, pm.name AS pm_name
         FROM aggregated_transactions at
         LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
         WHERE at.id = $1 AND at.branch_id = ANY($2::uuid[]) AND at.deleted_at IS NULL`,
        [sourceId, branchIds]
      )
      if (rows.length === 0) return null
      const data = rows[0]

      const { rows: stmts } = await pool.query(
        `SELECT id, credit_amount, description FROM bank_statements
         WHERE reconciliation_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [sourceId]
      )
      const stmt = stmts[0]

      return this.applyReview({
        id: `single_${data.id}`, source: 'SINGLE_MATCH', sourceId: data.id,
        transactionDate: data.transaction_date, bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null, bankAmount: Number(stmt?.credit_amount || 0),
        posNettAmount: Number(data.nett_amount), discrepancyAmount: Number(data.fee_discrepancy),
        paymentMethodName: data.pm_name || null, branchName: data.branch_name,
        status: 'PENDING', correctionJournalId: null, reviewedBy: null, reviewedAt: null,
        notes: data.fee_discrepancy_note,
      }, review)
    }

    if (source === 'MULTI_MATCH') {
      const { rows } = await pool.query(
        `SELECT g.id, g.total_bank_amount, g.aggregate_amount, g.difference,
                at.transaction_date, at.nett_amount, at.branch_name, pm.name AS pm_name
         FROM bank_reconciliation_groups g
         LEFT JOIN aggregated_transactions at ON at.id = g.aggregate_id
         LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
         WHERE g.id = $1 AND g.company_id = $2 AND g.deleted_at IS NULL`,
        [sourceId, companyId]
      )
      if (rows.length === 0) return null
      const data = rows[0]

      const { rows: stmts } = await pool.query(
        `SELECT id, credit_amount, description FROM bank_statements
         WHERE reconciliation_group_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [sourceId]
      )
      const stmt = stmts[0]

      return this.applyReview({
        id: `multi_${data.id}`, source: 'MULTI_MATCH', sourceId: data.id,
        transactionDate: data.transaction_date || '', bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null, bankAmount: Number(data.total_bank_amount),
        posNettAmount: Number(data.aggregate_amount), discrepancyAmount: -Number(data.difference),
        paymentMethodName: data.pm_name || null, branchName: data.branch_name || null,
        status: 'PENDING', correctionJournalId: null, reviewedBy: null, reviewedAt: null, notes: null,
      }, review)
    }

    if (source === 'SETTLEMENT_GROUP') {
      const { rows } = await pool.query(
        `SELECT sg.id, sg.bank_statement_id, sg.total_statement_amount, sg.total_allocated_amount, sg.difference,
                bs.id AS bs_id, bs.transaction_date AS bs_date, bs.description AS bs_desc, bs.credit_amount AS bs_credit
         FROM bank_settlement_groups sg
         LEFT JOIN bank_statements bs ON bs.id = sg.bank_statement_id
         WHERE sg.id = $1 AND sg.company_id = $2 AND sg.deleted_at IS NULL`,
        [sourceId, companyId]
      )
      if (rows.length === 0) return null
      const data = rows[0]

      return this.applyReview({
        id: `settlement_${data.id}`, source: 'SETTLEMENT_GROUP', sourceId: data.id,
        transactionDate: data.bs_date || '', bankStatementId: data.bank_statement_id,
        bankDescription: data.bs_desc || null, bankAmount: Number(data.total_statement_amount),
        posNettAmount: Number(data.total_allocated_amount), discrepancyAmount: -Number(data.difference),
        paymentMethodName: null, branchName: null,
        status: 'PENDING', correctionJournalId: null, reviewedBy: null, reviewedAt: null, notes: null,
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
      return dateDiff !== 0 ? dateDiff : Math.abs(b.discrepancyAmount) - Math.abs(a.discrepancyAmount)
    })

    const filtered = filter.status ? items.filter(i => i.status === filter.status) : items
    const amountFiltered = filter.minAmount ? filtered.filter(i => Math.abs(i.discrepancyAmount) >= filter.minAmount!) : filtered

    return { data: amountFiltered.slice(offset, offset + limit), total: amountFiltered.length }
  }

  async getSummary(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancySummary> {
    const { data } = await this.getDiscrepancies(companyId, { ...filter, page: 1, limit: 10000 })
    const summary: FeeDiscrepancySummary = {
      totalPending: 0, totalConfirmed: 0, totalCorrected: 0, totalDismissed: 0,
      sumPendingPositive: 0, sumPendingNegative: 0, sumConfirmedPositive: 0, sumConfirmedNegative: 0,
      count: data.length,
    }
    for (const item of data) {
      switch (item.status) {
        case 'PENDING':
          summary.totalPending++
          if (item.discrepancyAmount > 0) summary.sumPendingPositive += item.discrepancyAmount
          else summary.sumPendingNegative += item.discrepancyAmount
          break
        case 'CONFIRMED':
          summary.totalConfirmed++
          if (item.discrepancyAmount > 0) summary.sumConfirmedPositive += item.discrepancyAmount
          else summary.sumConfirmedNegative += item.discrepancyAmount
          break
        case 'CORRECTED': summary.totalCorrected++; break
        case 'DISMISSED': summary.totalDismissed++; break
      }
    }
    return summary
  }

  async updateStatus(
    companyId: string, source: FeeDiscrepancySource, sourceId: string,
    status: FeeDiscrepancyStatus, userId: string, notes?: string, correctionJournalId?: string,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO fee_discrepancy_reviews (source, source_id, company_id, status, notes, correction_journal_id, reviewed_by, reviewed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (source, source_id, company_id) DO UPDATE SET
         status = EXCLUDED.status, notes = EXCLUDED.notes,
         correction_journal_id = EXCLUDED.correction_journal_id,
         reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at, updated_at = EXCLUDED.updated_at`,
      [source, sourceId, companyId, status, notes || null, correctionJournalId || null, userId]
    )
    logInfo('Fee discrepancy status updated', { source, sourceId, status })
  }

  // ── Data source queries ──

  private async getSingleMatchDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const branchIds = await this.getBranchIdsByCompany(companyId)
    if (branchIds.length === 0) return []

    // Exclude multi-match and settlement aggregate IDs
    const [{ rows: groupAggs }, { rows: settlementAggs }] = await Promise.all([
      pool.query(`SELECT aggregate_id FROM bank_reconciliation_groups WHERE company_id = $1 AND deleted_at IS NULL`, [companyId]),
      pool.query(
        `SELECT bsa.aggregate_id FROM bank_settlement_aggregates bsa
         INNER JOIN bank_settlement_groups bsg ON bsg.id = bsa.settlement_group_id
         WHERE bsg.company_id = $1 AND bsg.deleted_at IS NULL`,
        [companyId]
      ),
    ])
    const excludeIds = new Set([
      ...groupAggs.map((g: { aggregate_id: string }) => g.aggregate_id),
      ...settlementAggs.map((s: { aggregate_id: string }) => s.aggregate_id),
    ])

    const conditions = [
      'at.branch_id = ANY($1::uuid[])',
      'at.is_reconciled = true',
      'at.fee_discrepancy != 0',
      'at.deleted_at IS NULL',
    ]
    const values: unknown[] = [branchIds]
    let idx = 2

    if (filter.dateFrom) { conditions.push(`at.transaction_date >= $${idx++}`); values.push(filter.dateFrom) }
    if (filter.dateTo) { conditions.push(`at.transaction_date <= $${idx++}`); values.push(filter.dateTo) }
    if (filter.paymentMethodId) { conditions.push(`at.payment_method_id = $${idx++}`); values.push(filter.paymentMethodId) }

    const { rows } = await pool.query(
      `SELECT at.id, at.transaction_date, at.fee_discrepancy, at.fee_discrepancy_note,
              at.nett_amount, at.payment_method_id, at.branch_name, pm.name AS pm_name
       FROM aggregated_transactions at
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE ${conditions.join(' AND ')}`,
      values
    )

    const filteredData = rows.filter(r => !excludeIds.has(r.id))
    const aggIds = filteredData.map(r => r.id)

    let stmtMap: Record<string, { id: string; credit_amount: number; description: string | null }> = {}
    if (aggIds.length > 0) {
      const { rows: stmts } = await pool.query(
        `SELECT id, reconciliation_id, credit_amount, description
         FROM bank_statements WHERE reconciliation_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [aggIds]
      )
      for (const s of stmts) stmtMap[s.reconciliation_id] = s
    }

    return filteredData.map(row => {
      const stmt = stmtMap[row.id]
      return {
        id: `single_${row.id}`, source: 'SINGLE_MATCH' as const, sourceId: row.id,
        transactionDate: row.transaction_date, bankStatementId: stmt?.id || '',
        bankDescription: stmt?.description || null, bankAmount: Number(stmt?.credit_amount || 0),
        posNettAmount: Number(row.nett_amount), discrepancyAmount: Number(row.fee_discrepancy),
        paymentMethodName: row.pm_name || null, branchName: row.branch_name,
        status: 'PENDING' as FeeDiscrepancyStatus, correctionJournalId: null,
        reviewedBy: null, reviewedAt: null, notes: row.fee_discrepancy_note,
      }
    })
  }

  private async getMultiMatchDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const { rows } = await pool.query(
      `SELECT g.id, g.aggregate_id, g.total_bank_amount, g.aggregate_amount, g.difference,
              at.transaction_date, at.nett_amount, at.branch_name, pm.name AS pm_name
       FROM bank_reconciliation_groups g
       LEFT JOIN aggregated_transactions at ON at.id = g.aggregate_id
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE g.company_id = $1 AND g.difference != 0 AND g.deleted_at IS NULL`,
      [companyId]
    )

    const groupIds = rows.map(r => r.id)
    let stmtMap: Record<string, { id: string; credit_amount: number; description: string | null }> = {}
    if (groupIds.length > 0) {
      const { rows: stmts } = await pool.query(
        `SELECT id, reconciliation_group_id, credit_amount, description
         FROM bank_statements WHERE reconciliation_group_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [groupIds]
      )
      for (const s of stmts) if (!stmtMap[s.reconciliation_group_id]) stmtMap[s.reconciliation_group_id] = s
    }

    return rows
      .filter(row => {
        if (filter.dateFrom && row.transaction_date && row.transaction_date < filter.dateFrom) return false
        if (filter.dateTo && row.transaction_date && row.transaction_date > filter.dateTo) return false
        return true
      })
      .map(row => ({
        id: `multi_${row.id}`, source: 'MULTI_MATCH' as const, sourceId: row.id,
        transactionDate: row.transaction_date || '', bankStatementId: stmtMap[row.id]?.id || '',
        bankDescription: stmtMap[row.id]?.description || null, bankAmount: Number(row.total_bank_amount),
        posNettAmount: Number(row.aggregate_amount), discrepancyAmount: -Number(row.difference),
        paymentMethodName: row.pm_name || null, branchName: row.branch_name || null,
        status: 'PENDING' as FeeDiscrepancyStatus, correctionJournalId: null,
        reviewedBy: null, reviewedAt: null, notes: null,
      }))
  }

  private async getSettlementDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter): Promise<FeeDiscrepancyItem[]> {
    const { rows } = await pool.query(
      `SELECT sg.id, sg.bank_statement_id, sg.total_statement_amount, sg.total_allocated_amount, sg.difference,
              bs.transaction_date AS bs_date, bs.description AS bs_desc
       FROM bank_settlement_groups sg
       LEFT JOIN bank_statements bs ON bs.id = sg.bank_statement_id
       WHERE sg.company_id = $1 AND sg.difference != 0 AND sg.deleted_at IS NULL`,
      [companyId]
    )

    // Get aggregate details for branch/pm names
    const sgIds = rows.map(r => r.id)
    let aggDetailsMap: Record<string, { branch_name: string | null; pm_name: string | null }> = {}
    if (sgIds.length > 0) {
      const { rows: aggRows } = await pool.query(
        `SELECT bsa.settlement_group_id, at.id AS agg_id, at.branch_name, pm.name AS pm_name
         FROM bank_settlement_aggregates bsa
         INNER JOIN aggregated_transactions at ON at.id = bsa.aggregate_id
         LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
         WHERE bsa.settlement_group_id = ANY($1::uuid[])`,
        [sgIds]
      )
      for (const a of aggRows) {
        if (!aggDetailsMap[a.settlement_group_id]) {
          aggDetailsMap[a.settlement_group_id] = { branch_name: a.branch_name, pm_name: a.pm_name }
        }
      }
    }

    return rows
      .filter(row => {
        if (filter.dateFrom && row.bs_date && row.bs_date < filter.dateFrom) return false
        if (filter.dateTo && row.bs_date && row.bs_date > filter.dateTo) return false
        return true
      })
      .map(row => {
        const details = aggDetailsMap[row.id]
        return {
          id: `settlement_${row.id}`, source: 'SETTLEMENT_GROUP' as const, sourceId: row.id,
          transactionDate: row.bs_date || '', bankStatementId: row.bank_statement_id,
          bankDescription: row.bs_desc || null, bankAmount: Number(row.total_statement_amount),
          posNettAmount: Number(row.total_allocated_amount), discrepancyAmount: -Number(row.difference),
          paymentMethodName: details?.pm_name || null, branchName: details?.branch_name || null,
          status: 'PENDING' as FeeDiscrepancyStatus, correctionJournalId: null,
          reviewedBy: null, reviewedAt: null, notes: null,
        }
      })
  }
}

export const feeDiscrepancyReviewRepository = new FeeDiscrepancyReviewRepository()
