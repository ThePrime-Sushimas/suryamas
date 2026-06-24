import { pool } from '../../../config/db'
import type { PoolClient } from 'pg'

export interface ClosingSnapshotHeader {
  id: string
  fiscal_period_id: string
  company_id: string
  version: number
  closing_journal_id: string | null
  is_latest: boolean
  net_income: number
  total_revenue: number
  total_expense: number
  closed_by: string
  closed_at: string
  created_at: string
}

export interface ClosingSnapshotSummary {
  id: string
  version: number
  is_latest: boolean
  net_income: number
  total_revenue: number
  total_expense: number
  closed_by: string
  closed_at: string
  closing_journal_id: string | null
}

class ClosingSnapshotsRepository {
  /**
   * Get all branch IDs for a company (including closed — snapshot is historical).
   */
  async findCompanyBranchIds(companyId: string): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT id FROM branches WHERE company_id = $1`,
      [companyId]
    )
    return rows.map(r => r.id)
  }

  /**
   * Execute a function within a database transaction.
   */
  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get next version number for a fiscal period.
   * Locks the PARENT fiscal_periods row (guaranteed to exist) to prevent
   * concurrent version collision — even when no snapshot rows exist yet.
   * Must be called within a transaction.
   */
  async getNextVersion(fiscalPeriodId: string, client: PoolClient): Promise<number> {
    // Lock parent row — always exists, prevents concurrent snapshot creation
    await client.query(
      `SELECT id FROM fiscal_periods WHERE id = $1 FOR UPDATE`,
      [fiscalPeriodId]
    )
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM fiscal_period_closing_snapshots
       WHERE fiscal_period_id = $1`,
      [fiscalPeriodId]
    )
    return rows[0].next_version
  }

  /**
   * Mark all existing versions for a period as not-latest.
   * Must be called WITHIN the same transaction as the new snapshot insert.
   */
  async markPreviousVersionsNotLatest(fiscalPeriodId: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE fiscal_period_closing_snapshots SET is_latest = false
       WHERE fiscal_period_id = $1 AND is_latest = true`,
      [fiscalPeriodId]
    )
  }

  /**
   * Insert snapshot header. Returns created row.
   */
  async insertHeader(
    client: PoolClient,
    data: {
      fiscal_period_id: string
      company_id: string
      version: number
      closing_journal_id: string | null
      net_income: number
      total_revenue: number
      total_expense: number
      closed_by: string
    },
  ): Promise<ClosingSnapshotHeader> {
    const { rows } = await client.query(
      `INSERT INTO fiscal_period_closing_snapshots
        (fiscal_period_id, company_id, version, closing_journal_id, is_latest, net_income, total_revenue, total_expense, closed_by)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8)
       RETURNING *`,
      [data.fiscal_period_id, data.company_id, data.version, data.closing_journal_id,
       data.net_income, data.total_revenue, data.total_expense, data.closed_by]
    )
    return rows[0] as ClosingSnapshotHeader
  }

  /**
   * Bulk insert trial balance lines.
   */
  async insertTrialBalanceLines(client: PoolClient, snapshotId: string, rows: Array<Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return

    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1

    for (const r of rows) {
      placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, $${idx+13}, $${idx+14}, $${idx+15}, $${idx+16}, $${idx+17}, $${idx+18}, $${idx+19}, $${idx+20}, $${idx+21})`)
      values.push(
        snapshotId, r.account_id, r.account_code, r.account_name, r.account_type,
        r.parent_account_code ?? null, r.parent_account_name ?? null,
        r.branch_id ?? null, r.branch_name ?? null, r.currency ?? 'IDR',
        Number(r.opening_debit ?? 0), Number(r.opening_credit ?? 0),
        Number(r.period_debit ?? 0), Number(r.period_credit ?? 0),
        Number(r.closing_debit ?? 0), Number(r.closing_credit ?? 0),
        Number(r.pos_debit ?? 0), Number(r.pos_credit ?? 0),
        Number(r.bank_debit ?? 0), Number(r.bank_credit ?? 0),
        Number(r.other_debit ?? 0), Number(r.other_credit ?? 0),
      )
      idx += 22
    }

    await client.query(
      `INSERT INTO closing_snapshot_trial_balance_lines
        (snapshot_id, account_id, account_code, account_name, account_type,
         parent_account_code, parent_account_name, branch_id, branch_name, currency,
         opening_debit, opening_credit, period_debit, period_credit,
         closing_debit, closing_credit, pos_debit, pos_credit,
         bank_debit, bank_credit, other_debit, other_credit)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  /**
   * Bulk insert income statement lines.
   */
  async insertIncomeStatementLines(client: PoolClient, snapshotId: string, rows: Array<Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return

    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1

    for (const r of rows) {
      placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, $${idx+13})`)
      values.push(
        snapshotId, r.account_id, r.account_code, r.account_name, r.account_type,
        r.parent_account_id ?? null, r.parent_account_code ?? null, r.parent_account_name ?? null,
        r.group_label ?? null, r.branch_id ?? null, r.branch_name ?? null,
        r.currency ?? 'IDR', Number(r.debit_amount ?? 0), Number(r.credit_amount ?? 0),
      )
      idx += 14
    }

    await client.query(
      `INSERT INTO closing_snapshot_income_statement_lines
        (snapshot_id, account_id, account_code, account_name, account_type,
         parent_account_id, parent_account_code, parent_account_name,
         group_label, branch_id, branch_name, currency, debit_amount, credit_amount)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  /**
   * Bulk insert balance sheet lines.
   */
  async insertBalanceSheetLines(client: PoolClient, snapshotId: string, rows: Array<Record<string, unknown>>): Promise<void> {
    if (rows.length === 0) return

    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1

    for (const r of rows) {
      placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, $${idx+13})`)
      values.push(
        snapshotId, r.account_id, r.account_code, r.account_name, r.account_type,
        r.parent_account_id ?? null, r.parent_account_code ?? null, r.parent_account_name ?? null,
        r.group_label ?? null, r.branch_id ?? null, r.branch_name ?? null,
        r.currency ?? 'IDR', Number(r.debit_amount ?? 0), Number(r.credit_amount ?? 0),
      )
      idx += 14
    }

    await client.query(
      `INSERT INTO closing_snapshot_balance_sheet_lines
        (snapshot_id, account_id, account_code, account_name, account_type,
         parent_account_id, parent_account_code, parent_account_name,
         group_label, branch_id, branch_name, currency, debit_amount, credit_amount)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  /**
   * List all versions for a fiscal period.
   */
  async listByPeriod(fiscalPeriodId: string, companyId: string): Promise<ClosingSnapshotSummary[]> {
    const { rows } = await pool.query(
      `SELECT id, version, is_latest, net_income, total_revenue, total_expense,
              closed_by, closed_at, closing_journal_id
       FROM fiscal_period_closing_snapshots
       WHERE fiscal_period_id = $1 AND company_id = $2
       ORDER BY version DESC`,
      [fiscalPeriodId, companyId]
    )
    return rows.map(r => ({
      ...r,
      net_income: Number(r.net_income),
      total_revenue: Number(r.total_revenue),
      total_expense: Number(r.total_expense),
    })) as ClosingSnapshotSummary[]
  }

  /**
   * Get snapshot by version number.
   */
  async findByVersion(fiscalPeriodId: string, version: number, companyId: string): Promise<ClosingSnapshotHeader | null> {
    const { rows } = await pool.query(
      `SELECT * FROM fiscal_period_closing_snapshots
       WHERE fiscal_period_id = $1 AND version = $2 AND company_id = $3`,
      [fiscalPeriodId, version, companyId]
    )
    return rows[0] ? this.castHeaderNumerics(rows[0]) : null
  }

  /**
   * Get latest snapshot for a period.
   */
  async findLatest(fiscalPeriodId: string, companyId: string): Promise<ClosingSnapshotHeader | null> {
    const { rows } = await pool.query(
      `SELECT * FROM fiscal_period_closing_snapshots
       WHERE fiscal_period_id = $1 AND company_id = $2 AND is_latest = true`,
      [fiscalPeriodId, companyId]
    )
    return rows[0] ? this.castHeaderNumerics(rows[0]) : null
  }

  private castHeaderNumerics(row: Record<string, unknown>): ClosingSnapshotHeader {
    return {
      ...row,
      net_income: Number(row.net_income),
      total_revenue: Number(row.total_revenue),
      total_expense: Number(row.total_expense),
    } as ClosingSnapshotHeader
  }

  /**
   * Get trial balance lines for a snapshot.
   */
  async getTrialBalanceLines(snapshotId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await pool.query(
      `SELECT account_id, account_code, account_name, account_type,
              parent_account_code, parent_account_name, branch_id, branch_name, currency,
              opening_debit, opening_credit, period_debit, period_credit,
              closing_debit, closing_credit, pos_debit, pos_credit,
              bank_debit, bank_credit, other_debit, other_credit
       FROM closing_snapshot_trial_balance_lines
       WHERE snapshot_id = $1
       ORDER BY account_code`,
      [snapshotId]
    )
    return rows
  }

  /**
   * Get income statement lines for a snapshot.
   */
  async getIncomeStatementLines(snapshotId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await pool.query(
      `SELECT account_id, account_code, account_name, account_type,
              parent_account_id, parent_account_code, parent_account_name,
              group_label, branch_id, branch_name, currency, debit_amount, credit_amount
       FROM closing_snapshot_income_statement_lines
       WHERE snapshot_id = $1
       ORDER BY account_type DESC, account_code`,
      [snapshotId]
    )
    return rows
  }

  /**
   * Get balance sheet lines for a snapshot.
   */
  async getBalanceSheetLines(snapshotId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await pool.query(
      `SELECT account_id, account_code, account_name, account_type,
              parent_account_id, parent_account_code, parent_account_name,
              group_label, branch_id, branch_name, currency, debit_amount, credit_amount
       FROM closing_snapshot_balance_sheet_lines
       WHERE snapshot_id = $1
       ORDER BY account_type, account_code`,
      [snapshotId]
    )
    return rows
  }
}

export const closingSnapshotsRepository = new ClosingSnapshotsRepository()
