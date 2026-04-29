import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'
import { IncomeStatementRow, IncomeStatementParams } from './income-statement.types'
import { IncomeStatementQueryError } from './income-statement.errors'

export class IncomeStatementRepository {
  async getIncomeStatement(params: IncomeStatementParams): Promise<{ current: IncomeStatementRow[]; compare: IncomeStatementRow[] }> {
    const current = await this.fetchPeriod(params.companyId, params.dateFrom, params.dateTo, params.branchIds)
    const compare = params.compareDateFrom && params.compareDateTo
      ? await this.fetchPeriod(params.companyId, params.compareDateFrom, params.compareDateTo, params.branchIds)
      : []
    return { current, compare }
  }

  private async fetchPeriod(companyId: string, dateFrom: string, dateTo: string, branchIds?: string[]): Promise<IncomeStatementRow[]> {
    try {
      const values: (string | string[])[] = [companyId, dateFrom, dateTo]
      const hasBranch = branchIds && branchIds.length > 0

      let branchFilter = ''
      if (hasBranch) {
        values.push(branchIds)
        branchFilter = `AND glv.branch_id = ANY($${values.length}::uuid[])`
      }

      const groupCols = hasBranch ? 'glv.account_id, glv.branch_id' : 'glv.account_id'

      const { rows } = await pool.query(
        `
        WITH period AS (
          SELECT ${groupCols},
            SUM(glv.debit_amount) AS debit_amount,
            SUM(glv.credit_amount) AS credit_amount
          FROM general_ledger_view glv
          JOIN chart_of_accounts coa ON coa.id = glv.account_id
          WHERE glv.company_id = $1::uuid
            AND coa.company_id = $1::uuid
            AND coa.account_type IN ('REVENUE', 'EXPENSE')
            AND glv.journal_date >= $2::date
            AND glv.journal_date <= $3::date
            ${branchFilter}
          GROUP BY ${groupCols}
        )
        SELECT
          p.account_id,
          coa.account_code,
          coa.account_name,
          coa.account_type,
          coa.parent_account_id,
          parent.account_code AS parent_account_code,
          parent.account_name AS parent_account_name,
          COALESCE(parent.account_name, coa.account_name) AS group_label,
          ${hasBranch ? 'p.branch_id' : 'NULL::uuid AS branch_id'},
          ${hasBranch ? 'b.branch_name' : 'NULL AS branch_name'},
          'IDR' AS currency,
          COALESCE(p.debit_amount, 0)::numeric AS debit_amount,
          COALESCE(p.credit_amount, 0)::numeric AS credit_amount
        FROM period p
        JOIN chart_of_accounts coa ON coa.id = p.account_id
        LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
        ${hasBranch ? 'LEFT JOIN branches b ON b.id = p.branch_id' : ''}
        ORDER BY coa.account_type DESC, coa.account_code
        `,
        values
      )
      return rows as IncomeStatementRow[]
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      logError('income_statement query failed', { error: message, companyId, dateFrom, dateTo })
      throw new IncomeStatementQueryError(`Income statement query failed: ${message}`)
    }
  }
}

export const incomeStatementRepository = new IncomeStatementRepository()
