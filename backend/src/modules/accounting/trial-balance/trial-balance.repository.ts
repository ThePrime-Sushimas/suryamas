import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'
import { TrialBalanceRow, TrialBalanceParams } from './trial-balance.types'

export class TrialBalanceRepository {
  async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceRow[]> {
    try {
      const values: any[] = [params.companyId, params.dateFrom, params.dateTo]
      const hasBranch = params.branchIds && params.branchIds.length > 0

      let branchFilter = ''
      if (hasBranch) {
        values.push(params.branchIds)
        branchFilter = `AND glv.branch_id = ANY($${values.length}::uuid[])`
      }

      const branchCol = hasBranch ? 'glv.branch_id' : 'NULL::uuid AS branch_id'
      const groupCols = hasBranch ? 'account_id, branch_id' : 'account_id'
      const joinBranch = hasBranch
        ? 'AND o.branch_id IS NOT DISTINCT FROM c.branch_id'
        : ''
      const joinBranchP = hasBranch
        ? 'AND p.branch_id IS NOT DISTINCT FROM c.branch_id'
        : ''

      const { rows } = await pool.query(
        `
        WITH
        all_lines AS (
          SELECT glv.account_id, ${branchCol}, glv.journal_date,
            glv.debit_amount, glv.credit_amount, glv.source_module
          FROM general_ledger_view glv
          JOIN chart_of_accounts coa_check ON coa_check.id = glv.account_id
          WHERE glv.company_id = $1::uuid
            AND coa_check.company_id = $1::uuid
            ${branchFilter}
        ),
        opening AS (
          SELECT ${groupCols},
            SUM(debit_amount) AS opening_debit,
            SUM(credit_amount) AS opening_credit
          FROM all_lines WHERE journal_date < $2::date
          GROUP BY ${groupCols}
        ),
        period AS (
          SELECT ${groupCols},
            SUM(debit_amount) AS period_debit,
            SUM(credit_amount) AS period_credit,
            SUM(CASE WHEN source_module = 'POS_AGGREGATES' THEN debit_amount ELSE 0 END) AS pos_debit,
            SUM(CASE WHEN source_module = 'POS_AGGREGATES' THEN credit_amount ELSE 0 END) AS pos_credit,
            SUM(CASE WHEN source_module = 'BANK_RECONCILIATION' THEN debit_amount ELSE 0 END) AS bank_debit,
            SUM(CASE WHEN source_module = 'BANK_RECONCILIATION' THEN credit_amount ELSE 0 END) AS bank_credit,
            SUM(CASE WHEN source_module NOT IN ('POS_AGGREGATES', 'BANK_RECONCILIATION') OR source_module IS NULL THEN debit_amount ELSE 0 END) AS other_debit,
            SUM(CASE WHEN source_module NOT IN ('POS_AGGREGATES', 'BANK_RECONCILIATION') OR source_module IS NULL THEN credit_amount ELSE 0 END) AS other_credit
          FROM all_lines WHERE journal_date >= $2::date AND journal_date <= $3::date
          GROUP BY ${groupCols}
        ),
        combined AS (
          SELECT account_id${hasBranch ? ', branch_id' : ''} FROM opening
          UNION
          SELECT account_id${hasBranch ? ', branch_id' : ''} FROM period
        )
        SELECT
          c.account_id,
          coa.account_code,
          coa.account_name,
          coa.account_type,
          parent.account_code AS parent_account_code,
          parent.account_name AS parent_account_name,
          ${hasBranch ? 'c.branch_id' : 'NULL::uuid AS branch_id'},
          ${hasBranch ? 'b.branch_name' : "NULL AS branch_name"},
          'IDR' AS currency,
          COALESCE(p.period_debit, 0)::numeric AS period_debit,
          COALESCE(p.period_credit, 0)::numeric AS period_credit,
          COALESCE(p.pos_debit, 0)::numeric AS pos_debit,
          COALESCE(p.pos_credit, 0)::numeric AS pos_credit,
          COALESCE(p.bank_debit, 0)::numeric AS bank_debit,
          COALESCE(p.bank_credit, 0)::numeric AS bank_credit,
          COALESCE(p.other_debit, 0)::numeric AS other_debit,
          COALESCE(p.other_credit, 0)::numeric AS other_credit,
          -- Opening nett: debit - credit, split into debit/credit side
          GREATEST(COALESCE(o.opening_debit, 0) - COALESCE(o.opening_credit, 0), 0)::numeric AS opening_debit,
          GREATEST(COALESCE(o.opening_credit, 0) - COALESCE(o.opening_debit, 0), 0)::numeric AS opening_credit,
          -- Ending nett: (opening + mutation), split into debit/credit side
          GREATEST(
            (COALESCE(o.opening_debit, 0) + COALESCE(p.period_debit, 0)) -
            (COALESCE(o.opening_credit, 0) + COALESCE(p.period_credit, 0)),
          0)::numeric AS closing_debit,
          GREATEST(
            (COALESCE(o.opening_credit, 0) + COALESCE(p.period_credit, 0)) -
            (COALESCE(o.opening_debit, 0) + COALESCE(p.period_debit, 0)),
          0)::numeric AS closing_credit
        FROM combined c
        JOIN chart_of_accounts coa ON coa.id = c.account_id
        LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
        ${hasBranch ? 'LEFT JOIN branches b ON b.id = c.branch_id' : ''}
        LEFT JOIN opening o ON o.account_id = c.account_id ${joinBranch}
        LEFT JOIN period p ON p.account_id = c.account_id ${joinBranchP}
        ORDER BY coa.account_code${hasBranch ? ', b.branch_name NULLS LAST' : ''}
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
