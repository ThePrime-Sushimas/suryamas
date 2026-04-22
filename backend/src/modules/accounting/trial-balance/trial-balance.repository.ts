import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'
import { TrialBalanceRow, TrialBalanceParams } from './trial-balance.types'

export class TrialBalanceRepository {
  async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceRow[]> {
    try {
      const { rows } = await pool.query(
        `
        WITH
        all_lines AS (
          SELECT
            glv.account_id,
            glv.account_code,
            glv.account_name,
            glv.account_type,
            glv.account_subtype,
            glv.normal_balance,
            glv.parent_account_id,
            glv.account_level,
            glv.journal_date,
            glv.debit_amount,
            glv.credit_amount
          FROM general_ledger_view glv
          JOIN chart_of_accounts coa_check ON coa_check.id = glv.account_id
          WHERE glv.company_id = $1::uuid
            AND coa_check.company_id = $1::uuid
            AND ($4::uuid IS NULL OR glv.branch_id = $4::uuid)
        ),
        opening AS (
          SELECT
            account_id,
            SUM(debit_amount)  AS opening_debit,
            SUM(credit_amount) AS opening_credit
          FROM all_lines
          WHERE journal_date < $2::date
          GROUP BY account_id
        ),
        period AS (
          SELECT
            account_id,
            SUM(debit_amount)  AS period_debit,
            SUM(credit_amount) AS period_credit
          FROM all_lines
          WHERE journal_date >= $2::date
            AND journal_date <= $3::date
          GROUP BY account_id
        ),
        coa_base AS (
          SELECT DISTINCT account_id, account_code, account_name,
            account_type, account_subtype, normal_balance,
            parent_account_id, account_level
          FROM all_lines
        )
        SELECT
          cb.account_id,
          cb.account_code,
          cb.account_name,
          cb.account_type,
          cb.account_subtype,
          cb.normal_balance,
          cb.parent_account_id,
          cb.account_level,
          COALESCE(o.opening_debit, 0)::numeric  AS opening_debit,
          COALESCE(o.opening_credit, 0)::numeric AS opening_credit,
          (COALESCE(o.opening_debit, 0) - COALESCE(o.opening_credit, 0))::numeric AS opening_balance,
          COALESCE(p.period_debit, 0)::numeric  AS period_debit,
          COALESCE(p.period_credit, 0)::numeric AS period_credit,
          (COALESCE(p.period_debit, 0) - COALESCE(p.period_credit, 0))::numeric AS period_net,
          (COALESCE(o.opening_debit, 0) + COALESCE(p.period_debit, 0))::numeric  AS closing_debit,
          (COALESCE(o.opening_credit, 0) + COALESCE(p.period_credit, 0))::numeric AS closing_credit,
          ((COALESCE(o.opening_debit, 0) + COALESCE(p.period_debit, 0)) -
           (COALESCE(o.opening_credit, 0) + COALESCE(p.period_credit, 0)))::numeric AS closing_balance
        FROM coa_base cb
        LEFT JOIN opening o ON o.account_id = cb.account_id
        LEFT JOIN period p  ON p.account_id = cb.account_id
        ORDER BY cb.account_code ASC
        `,
        [params.companyId, params.dateFrom, params.dateTo, params.branchId ?? null]
      )
      return rows as TrialBalanceRow[]
    } catch (error: any) {
      logError('get_trial_balance query failed', { error: error.message, params })
      throw new Error(`Trial balance query failed: ${error.message}`)
    }
  }
}

export const trialBalanceRepository = new TrialBalanceRepository()
