import { pool } from '../../../config/db'
import type { GeneralLedgerLine, GeneralLedgerAccountInfo } from './general-ledger.types'

export interface OpeningBalanceRow {
  account_id: string
  opening_debit: number
  opening_credit: number
  opening_balance: number
}

export interface PeriodTotalsRow {
  account_id: string
  total_debit: number
  total_credit: number
}

export class GeneralLedgerRepository {
  /**
   * Get account info for multiple accounts
   */
  async getAccountInfoMulti(accountIds: string[], companyIds: string[]): Promise<GeneralLedgerAccountInfo[]> {
    const { rows } = await pool.query(
      `SELECT id AS account_id, account_code, account_name, account_type, normal_balance
       FROM chart_of_accounts
       WHERE id = ANY($1::uuid[]) AND company_id = ANY($2::uuid[]) AND deleted_at IS NULL
       ORDER BY account_code`,
      [accountIds, companyIds]
    )
    return rows
  }

  /**
   * Get opening balance for multiple accounts before date_from
   */
  async getOpeningBalanceMulti(
    accountIds: string[],
    companyIds: string[],
    dateFrom: string,
    branchIds: string[],
  ): Promise<OpeningBalanceRow[]> {
    const { rows } = await pool.query(
      `SELECT
        glv.account_id,
        COALESCE(SUM(glv.debit_amount), 0)::numeric AS opening_debit,
        COALESCE(SUM(glv.credit_amount), 0)::numeric AS opening_credit
      FROM general_ledger_view glv
      WHERE glv.account_id = ANY($1::uuid[])
        AND glv.company_id = ANY($2::uuid[])
        AND glv.journal_date < $3::date
        AND glv.branch_id = ANY($4::uuid[])
      GROUP BY glv.account_id`,
      [accountIds, companyIds, dateFrom, branchIds]
    )

    // Include accounts with zero opening
    return accountIds.map(id => {
      const row = rows.find((r: { account_id: string }) => r.account_id === id)
      const debit = Number(row?.opening_debit ?? 0)
      const credit = Number(row?.opening_credit ?? 0)
      return {
        account_id: id,
        opening_debit: debit,
        opening_credit: credit,
        opening_balance: debit - credit,
      }
    })
  }

  /**
   * Get total count of lines for pagination (multi-account)
   */
  async getLineCountMulti(
    accountIds: string[],
    companyIds: string[],
    dateFrom: string,
    dateTo: string,
    branchIds: string[],
    search?: string,
  ): Promise<number> {
    const conditions = [
      'glv.account_id = ANY($1::uuid[])',
      'glv.company_id = ANY($2::uuid[])',
      'glv.journal_date >= $3::date',
      'glv.journal_date <= $4::date',
      'glv.branch_id = ANY($5::uuid[])',
    ]
    const params: unknown[] = [accountIds, companyIds, dateFrom, dateTo, branchIds]

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(glv.line_description ILIKE $${params.length} OR glv.journal_description ILIKE $${params.length} OR glv.journal_number ILIKE $${params.length} OR glv.reference_number ILIKE $${params.length})`)
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM general_ledger_view glv
       WHERE ${conditions.join(' AND ')}`,
      params
    )

    return rows[0]?.total ?? 0
  }

  /**
   * Get ledger lines with running balance for multiple accounts.
   * Running balance is partitioned by account_id.
   */
  async getLinesMulti(
    accountIds: string[],
    companyIds: string[],
    dateFrom: string,
    dateTo: string,
    branchIds: string[],
    accounts: GeneralLedgerAccountInfo[],
    openings: OpeningBalanceRow[],
    limit: number,
    offset: number,
    search?: string,
  ): Promise<GeneralLedgerLine[]> {
    const conditions = [
      'glv.account_id = ANY($1::uuid[])',
      'glv.company_id = ANY($2::uuid[])',
      'glv.journal_date >= $3::date',
      'glv.journal_date <= $4::date',
      'glv.branch_id = ANY($5::uuid[])',
    ]
    const params: unknown[] = [accountIds, companyIds, dateFrom, dateTo, branchIds]
    let idx = 6

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(glv.line_description ILIKE $${idx} OR glv.journal_description ILIKE $${idx} OR glv.journal_number ILIKE $${idx} OR glv.reference_number ILIKE $${idx})`)
      idx++
    }

    // Build a CASE expression for per-account opening balance and normal_balance direction
    const openingCases = accounts.map(acc => {
      const opening = openings.find(o => o.account_id === acc.account_id)
      const openBal = opening?.opening_balance ?? 0
      return `WHEN glv.account_id = '${acc.account_id}' THEN ${openBal}`
    }).join(' ')

    const netCases = accounts.map(acc => {
      if (acc.normal_balance === 'DEBIT') {
        return `WHEN glv.account_id = '${acc.account_id}' THEN glv.debit_amount - glv.credit_amount`
      }
      return `WHEN glv.account_id = '${acc.account_id}' THEN glv.credit_amount - glv.debit_amount`
    }).join(' ')

    params.push(limit, offset)
    const limitIdx = idx
    const offsetIdx = idx + 1

    const { rows } = await pool.query(
      `SELECT
        glv.line_id,
        glv.journal_header_id,
        glv.account_id,
        glv.account_code,
        glv.account_name,
        glv.journal_date::text AS journal_date,
        glv.journal_number,
        glv.journal_type,
        glv.source_module,
        glv.journal_description,
        glv.line_description,
        glv.reference_number,
        glv.reference_type,
        glv.reference_id,
        glv.debit_amount::numeric AS debit_amount,
        glv.credit_amount::numeric AS credit_amount,
        (CASE ${netCases} END)::numeric AS net_amount,
        glv.branch_id,
        (
          (CASE ${openingCases} END) +
          SUM(CASE ${netCases} END) OVER (
            PARTITION BY glv.account_id
            ORDER BY glv.journal_date, glv.journal_number, glv.line_number
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )
        )::numeric AS running_balance
      FROM general_ledger_view glv
      WHERE ${conditions.join(' AND ')}
      ORDER BY glv.account_code, glv.journal_date, glv.journal_number, glv.line_number
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )

    return rows.map(r => ({
      line_id: r.line_id,
      journal_header_id: r.journal_header_id,
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      journal_date: r.journal_date,
      journal_number: r.journal_number,
      journal_type: r.journal_type,
      source_module: r.source_module,
      journal_description: r.journal_description,
      line_description: r.line_description,
      reference_number: r.reference_number,
      reference_type: r.reference_type,
      reference_id: r.reference_id,
      debit_amount: Number(r.debit_amount),
      credit_amount: Number(r.credit_amount),
      net_amount: Number(r.net_amount),
      running_balance: Number(r.running_balance),
      branch_id: r.branch_id,
    }))
  }

  /**
   * Get total debit/credit for the period per account
   */
  async getPeriodTotalsMulti(
    accountIds: string[],
    companyIds: string[],
    dateFrom: string,
    dateTo: string,
    branchIds: string[],
    search?: string,
  ): Promise<PeriodTotalsRow[]> {
    const conditions = [
      'glv.account_id = ANY($1::uuid[])',
      'glv.company_id = ANY($2::uuid[])',
      'glv.journal_date >= $3::date',
      'glv.journal_date <= $4::date',
      'glv.branch_id = ANY($5::uuid[])',
    ]
    const params: unknown[] = [accountIds, companyIds, dateFrom, dateTo, branchIds]

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(glv.line_description ILIKE $${params.length} OR glv.journal_description ILIKE $${params.length} OR glv.journal_number ILIKE $${params.length} OR glv.reference_number ILIKE $${params.length})`)
    }

    const { rows } = await pool.query(
      `SELECT
        glv.account_id,
        COALESCE(SUM(glv.debit_amount), 0)::numeric AS total_debit,
        COALESCE(SUM(glv.credit_amount), 0)::numeric AS total_credit
      FROM general_ledger_view glv
      WHERE ${conditions.join(' AND ')}
      GROUP BY glv.account_id`,
      params
    )

    return accountIds.map(id => {
      const row = rows.find((r: { account_id: string }) => r.account_id === id)
      return {
        account_id: id,
        total_debit: Number(row?.total_debit ?? 0),
        total_credit: Number(row?.total_credit ?? 0),
      }
    })
  }
}

export const generalLedgerRepository = new GeneralLedgerRepository()
