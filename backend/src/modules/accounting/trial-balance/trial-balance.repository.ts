import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'
import { TrialBalanceRow, TrialBalanceParams } from './trial-balance.types'

export class TrialBalanceRepository {
  async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceRow[]> {
    try {
      const values: any[] = [params.companyId, params.dateFrom, params.dateTo]
      let branchFilter = ''

      if (params.branchIds && params.branchIds.length > 0) {
        values.push(params.branchIds)
        branchFilter = `AND glv.branch_id = ANY($${values.length}::uuid[])`
      }

      const { rows } = await pool.query(
        `
        WITH
        all_lines AS (
          SELECT
            glv.account_id,
            glv.branch_id,
            glv.journal_date,
            glv.debit_amount,
            glv.credit_amount
          FROM general_ledger_view glv
          JOIN chart_of_accounts coa_check ON coa_check.id = glv.account_id
          WHERE glv.company_id = $1::uuid
            AND coa_check.company_id = $1::uuid
            ${branchFilter}
        ),
        opening AS (
          SELECT account_id, branch_id,
            SUM(debit_amount) AS opening_debit,
            SUM(credit_amount) AS opening_credit
          FROM all_lines
          WHERE journal_date < $2::date
          GROUP BY account_id, branch_id
        ),
        period AS (
          SELECT account_id, branch_id,
            SUM(debit_amount) AS period_debit,
            SUM(credit_amount) AS period_credit
          FROM all_lines
          WHERE journal_date >= $2::date AND journal_date <= $3::date
          GROUP BY account_id, branch_id
        ),
        combined AS (
          SELECT account_id, branch_id FROM opening
          UNION
          SELECT account_id, branch_id FROM period
        )
        SELECT
          c.account_id,
          coa.account_code,
          coa.account_name,
          coa.account_type,
          parent.account_code AS parent_account_code,
          parent.account_name AS parent_account_name,
          c.branch_id,
          b.branch_name,
          'IDR' AS currency,
          COALESCE(o.opening_debit, 0)::numeric AS opening_debit,
          COALESCE(o.opening_credit, 0)::numeric AS opening_credit,
          COALESCE(p.period_debit, 0)::numeric AS period_debit,
          COALESCE(p.period_credit, 0)::numeric AS period_credit,
          (COALESCE(o.opening_debit, 0) + COALESCE(p.period_debit, 0))::numeric AS closing_debit,
          (COALESCE(o.opening_credit, 0) + COALESCE(p.period_credit, 0))::numeric AS closing_credit
        FROM combined c
        JOIN chart_of_accounts coa ON coa.id = c.account_id
        LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
        LEFT JOIN branches b ON b.id = c.branch_id
        LEFT JOIN opening o ON o.account_id = c.account_id AND o.branch_id IS NOT DISTINCT FROM c.branch_id
        LEFT JOIN period p ON p.account_id = c.account_id AND p.branch_id IS NOT DISTINCT FROM c.branch_id
        ORDER BY coa.account_code, b.branch_name NULLS LAST
        `,
        values
      )
      return rows as TrialBalanceRow[]
    } catch (error: any) {
      logError('get_trial_balance query failed', { error: error.message, params })
      throw new Error(`Trial balance query failed: ${error.message}`)
    }
  }
}

export const trialBalanceRepository = new TrialBalanceRepository()
