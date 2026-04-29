import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'
import { BalanceSheetRow, BalanceSheetParams } from './balance-sheet.types'
import { BalanceSheetQueryError } from './balance-sheet.errors'

export class BalanceSheetRepository {
  async getBalanceSheet(params: BalanceSheetParams): Promise<{ current: BalanceSheetRow[]; compare: BalanceSheetRow[] }> {
    const current = await this.fetchAsOf(params.companyId, params.asOfDate, params.branchIds)
    const compare = params.compareAsOfDate
      ? await this.fetchAsOf(params.companyId, params.compareAsOfDate, params.branchIds)
      : []
    return { current, compare }
  }

  private async fetchAsOf(companyId: string, asOfDate: string, branchIds?: string[]): Promise<BalanceSheetRow[]> {
    try {
      const values: (string | string[])[] = [companyId, asOfDate]
      const hasBranch = branchIds && branchIds.length > 0

      let branchFilter = ''
      if (hasBranch) {
        values.push(branchIds)
        branchFilter = `AND glv.branch_id = ANY($${values.length}::uuid[])`
      }

      const groupCols = hasBranch ? 'glv.account_id, glv.branch_id' : 'glv.account_id'

      const { rows } = await pool.query(
        `
        WITH balances AS (
          SELECT ${groupCols},
            SUM(glv.debit_amount) AS debit_amount,
            SUM(glv.credit_amount) AS credit_amount
          FROM general_ledger_view glv
          JOIN chart_of_accounts coa ON coa.id = glv.account_id
          WHERE glv.company_id = $1::uuid
            AND coa.company_id = $1::uuid
            AND coa.account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
            AND glv.journal_date <= $2::date
            ${branchFilter}
          GROUP BY ${groupCols}
        )
        SELECT
          b.account_id,
          coa.account_code,
          coa.account_name,
          coa.account_type,
          coa.parent_account_id,
          parent.account_code AS parent_account_code,
          parent.account_name AS parent_account_name,
          COALESCE(parent.account_name, coa.account_name) AS group_label,
          ${hasBranch ? 'b.branch_id' : 'NULL::uuid AS branch_id'},
          ${hasBranch ? 'br.branch_name' : 'NULL AS branch_name'},
          'IDR' AS currency,
          COALESCE(b.debit_amount, 0)::numeric AS debit_amount,
          COALESCE(b.credit_amount, 0)::numeric AS credit_amount
        FROM balances b
        JOIN chart_of_accounts coa ON coa.id = b.account_id
        LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
        ${hasBranch ? 'LEFT JOIN branches br ON br.id = b.branch_id' : ''}
        ORDER BY coa.account_type, coa.account_code
        `,
        values
      )
      return rows as BalanceSheetRow[]
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      logError('balance_sheet query failed', { error: message, companyId, asOfDate })
      throw new BalanceSheetQueryError(`Balance sheet query failed: ${message}`)
    }
  }

  /**
   * Retained earnings = Revenue - Expense, always company-level.
   * Not filtered by branch because retained earnings is a company-wide figure.
   * Filtering by branch would show misleading P&L for individual branches.
   */
  async getRetainedEarnings(companyId: string, asOfDate: string): Promise<number> {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN coa.account_type = 'REVENUE' THEN glv.credit_amount - glv.debit_amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN coa.account_type = 'EXPENSE' THEN glv.debit_amount - glv.credit_amount ELSE 0 END), 0)
          AS retained_earnings
        FROM general_ledger_view glv
        JOIN chart_of_accounts coa ON coa.id = glv.account_id
        WHERE glv.company_id = $1::uuid
          AND coa.company_id = $1::uuid
          AND coa.account_type IN ('REVENUE', 'EXPENSE')
          AND glv.journal_date <= $2::date
        `,
        [companyId, asOfDate]
      )
      return Number(rows[0]?.retained_earnings ?? 0)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      logError('retained_earnings query failed', { error: message, companyId, asOfDate })
      throw new BalanceSheetQueryError(`Retained earnings query failed: ${message}`)
    }
  }
}

export const balanceSheetRepository = new BalanceSheetRepository()
