import { pool } from '../../../config/db'
import type { DailyLedgerMovement, DailyLedgerOpening } from './daily-ledger.types'

export class DailyLedgerRepository {
  /**
   * Get daily movements grouped by account + date
   */
  async getDailyMovements(
    companyIds: string[],
    dateFrom: string,
    dateTo: string,
    branchIds: string[],
  ): Promise<DailyLedgerMovement[]> {
    const conditions = [
      'glv.company_id = ANY($1::uuid[])',
      'glv.journal_date >= $2::date',
      'glv.journal_date <= $3::date',
      'glv.branch_id = ANY($4::uuid[])',
    ]
    const params: unknown[] = [companyIds, dateFrom, dateTo, branchIds]

    const { rows } = await pool.query(
      `SELECT
        glv.account_id,
        glv.account_code,
        glv.account_name,
        glv.account_type,
        parent.account_code AS parent_account_code,
        parent.account_name AS parent_account_name,
        glv.journal_date::text AS journal_date,
        SUM(glv.debit_amount)::numeric AS debit_amount,
        SUM(glv.credit_amount)::numeric AS credit_amount
      FROM general_ledger_view glv
      LEFT JOIN chart_of_accounts coa ON coa.id = glv.account_id
      LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY glv.account_id, glv.account_code, glv.account_name, glv.account_type,
               parent.account_code, parent.account_name, glv.journal_date
      HAVING SUM(glv.debit_amount) != 0 OR SUM(glv.credit_amount) != 0
      ORDER BY glv.account_code, glv.journal_date`,
      params
    )

    return rows.map(r => ({
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: r.account_type,
      parent_account_code: r.parent_account_code,
      parent_account_name: r.parent_account_name,
      journal_date: r.journal_date,
      debit_amount: Number(r.debit_amount),
      credit_amount: Number(r.credit_amount),
    }))
  }

  /**
   * Get opening balance (all movements before date_from)
   */
  async getOpeningBalances(
    companyIds: string[],
    dateFrom: string,
    branchIds: string[],
  ): Promise<DailyLedgerOpening[]> {
    const conditions = [
      'glv.company_id = ANY($1::uuid[])',
      'glv.journal_date < $2::date',
      'glv.branch_id = ANY($3::uuid[])',
    ]
    const params: unknown[] = [companyIds, dateFrom, branchIds]

    const { rows } = await pool.query(
      `SELECT
        glv.account_id,
        glv.account_code,
        glv.account_name,
        glv.account_type,
        parent.account_code AS parent_account_code,
        parent.account_name AS parent_account_name,
        SUM(glv.debit_amount)::numeric AS opening_debit,
        SUM(glv.credit_amount)::numeric AS opening_credit
      FROM general_ledger_view glv
      LEFT JOIN chart_of_accounts coa ON coa.id = glv.account_id
      LEFT JOIN chart_of_accounts parent ON parent.id = coa.parent_account_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY glv.account_id, glv.account_code, glv.account_name, glv.account_type,
               parent.account_code, parent.account_name
      HAVING SUM(glv.debit_amount) != 0 OR SUM(glv.credit_amount) != 0
      ORDER BY glv.account_code`,
      params
    )

    return rows.map(r => ({
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: r.account_type,
      parent_account_code: r.parent_account_code,
      parent_account_name: r.parent_account_name,
      opening_debit: Number(r.opening_debit),
      opening_credit: Number(r.opening_credit),
    }))
  }
}

export const dailyLedgerRepository = new DailyLedgerRepository()
