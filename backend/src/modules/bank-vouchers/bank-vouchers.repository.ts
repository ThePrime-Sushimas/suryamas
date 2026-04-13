import { pool } from '../../config/db'
import type { AggregatedVoucherRow, BankAccountOption } from './bank-vouchers.types'
import { BankVoucherInvalidBankAccountError } from './bank-vouchers.errors'

/**
 * Bank Vouchers Repository
 * Handle semua query database untuk bank vouchers system
 */
export class BankVouchersRepository {

  // ============================================
  // MAIN: fetch reconciled aggregates per period
  // Grouped by: transaction_date + bank_account + payment_method
  // ============================================

  async getReconciledAggregates(params: {
    company_id: string
    branch_id?: string
    date_start: string          // 'YYYY-MM-DD'
    date_end: string            // 'YYYY-MM-DD'
    bank_account_id?: number
  }): Promise<AggregatedVoucherRow[]> {
    const values: unknown[] = [params.company_id, params.date_start, params.date_end]
    let paramIndex = 4

    const conditions: string[] = [
      'at.deleted_at IS NULL',
      'at.is_reconciled = TRUE',
      'at.superseded_by IS NULL',           // exclude versi lama yang sudah digantikan
      'pm.bank_account_id IS NOT NULL',     // hanya payment method yang punya mapping bank
      'pm.deleted_at IS NULL',
      'ba.deleted_at IS NULL',
      // filter company via branch
      'br.company_id = $1',
      'at.transaction_date BETWEEN $2 AND $3',
    ]

    if (params.branch_id) {
      conditions.push(`at.branch_id = $${paramIndex}`)
      values.push(params.branch_id)
      paramIndex++
    }

    if (params.bank_account_id) {
      conditions.push(`pm.bank_account_id = $${paramIndex}`)
      values.push(params.bank_account_id)
      paramIndex++
    }

    const whereClause = conditions.map(c => `  AND ${c}`).join('\n').replace(/^  AND /, 'WHERE ')

    const sql = `
      SELECT
        at.transaction_date,
        pm.bank_account_id,
        ba.account_name                             AS bank_account_name,
        ba.account_number                           AS bank_account_number,
        pm.id                                       AS payment_method_id,
        pm.name                                     AS payment_method_name,
        pm.payment_type,
        at.branch_id,
        COALESCE(at.branch_name, br.branch_name)    AS branch_name,
        -- Amounts (SUM per group)
        SUM(at.gross_amount)                        AS gross_amount,
        SUM(at.tax_amount)                          AS tax_amount,
        SUM(at.actual_nett_amount)                  AS actual_nett_amount,
        -- Fee: actual yang terjadi (termasuk discrepancy)
        SUM(at.actual_fee_amount)                   AS actual_fee_amount,
        SUM(at.fee_discrepancy)                     AS fee_discrepancy,
        -- total_fee = actual_fee + discrepancy (fee sesungguhnya yang dipotong bank)
        SUM(at.actual_fee_amount + at.fee_discrepancy) AS total_fee_amount,
        COUNT(*)::text                              AS transaction_count
      FROM aggregated_transactions at
      JOIN payment_methods pm
        ON pm.id = at.payment_method_id
      JOIN bank_accounts ba
        ON ba.id = pm.bank_account_id
      JOIN branches br
        ON br.id = at.branch_id
      ${whereClause}
      GROUP BY
        at.transaction_date,
        pm.bank_account_id,
        ba.account_name,
        ba.account_number,
        pm.id,
        pm.name,
        pm.payment_type,
        at.branch_id,
        COALESCE(at.branch_name, br.branch_name)
      ORDER BY
        at.transaction_date ASC,
        pm.bank_account_id ASC,
        pm.name ASC
    `

    const result = await pool.query<AggregatedVoucherRow>(sql, values)
    return result.rows
  }

  // ============================================
  // SUMMARY: total per bank per period
  // ============================================

  async getPeriodSummaryByBank(params: {
    company_id: string
    branch_id?: string
    date_start: string
    date_end: string
  }): Promise<{
    bank_account_id: number
    bank_account_name: string
    total_nett: string
    total_fee: string
  }[]> {
    const values: unknown[] = [params.company_id, params.date_start, params.date_end]
    let paramIndex = 4

    let branchFilter = ''
    if (params.branch_id) {
      branchFilter = `AND at.branch_id = $${paramIndex}`
      values.push(params.branch_id)
      paramIndex++
    }

    const sql = `
      SELECT
        pm.bank_account_id,
        ba.account_name                              AS bank_account_name,
        SUM(at.actual_nett_amount)                   AS total_nett,
        SUM(at.actual_fee_amount + at.fee_discrepancy) AS total_fee
      FROM aggregated_transactions at
      JOIN payment_methods pm ON pm.id = at.payment_method_id
      JOIN bank_accounts ba   ON ba.id = pm.bank_account_id
      JOIN branches br        ON br.id = at.branch_id
      WHERE at.deleted_at IS NULL
        AND at.is_reconciled = TRUE
        AND at.superseded_by IS NULL
        AND pm.bank_account_id IS NOT NULL
        AND pm.deleted_at IS NULL
        AND ba.deleted_at IS NULL
        AND br.company_id = $1
        AND at.transaction_date BETWEEN $2 AND $3
        ${branchFilter}
      GROUP BY pm.bank_account_id, ba.account_name
      ORDER BY ba.account_name ASC
    `

    const result = await pool.query(sql, values)
    return result.rows
  }

  // ============================================
  // SUMMARY: total per day (untuk running balance)
  // ============================================

  async getDailySummary(params: {
    company_id: string
    branch_id?: string
    date_start: string
    date_end: string
  }): Promise<{
    transaction_date: Date
    total_nett: string
    total_fee: string
  }[]> {
    const values: unknown[] = [params.company_id, params.date_start, params.date_end]
    let paramIndex = 4

    let branchFilter = ''
    if (params.branch_id) {
      branchFilter = `AND at.branch_id = $${paramIndex}`
      values.push(params.branch_id)
      paramIndex++
    }

    const sql = `
      SELECT
        at.transaction_date,
        SUM(at.actual_nett_amount)                   AS total_nett,
        SUM(at.actual_fee_amount + at.fee_discrepancy) AS total_fee
      FROM aggregated_transactions at
      JOIN payment_methods pm ON pm.id = at.payment_method_id
      JOIN bank_accounts ba   ON ba.id = pm.bank_account_id
      JOIN branches br        ON br.id = at.branch_id
      WHERE at.deleted_at IS NULL
        AND at.is_reconciled = TRUE
        AND at.superseded_by IS NULL
        AND pm.bank_account_id IS NOT NULL
        AND pm.deleted_at IS NULL
        AND ba.deleted_at IS NULL
        AND br.company_id = $1
        AND at.transaction_date BETWEEN $2 AND $3
        ${branchFilter}
      GROUP BY at.transaction_date
      ORDER BY at.transaction_date ASC
    `

    const result = await pool.query(sql, values)
    return result.rows
  }

  // ============================================
  // DROPDOWN: bank accounts untuk filter
  // ============================================

  async getBankAccountsByCompany(company_id: string): Promise<BankAccountOption[]> {
    // bank_accounts yang punya mapping ke payment_methods aktif di company ini
    const sql = `
      SELECT DISTINCT
        ba.id,
        ba.account_name,
        ba.account_number,
        COALESCE(ba.bank_id::text, ba.account_name) AS bank_name
      FROM bank_accounts ba
      JOIN payment_methods pm
        ON pm.bank_account_id = ba.id
       AND pm.company_id = $1
       AND pm.deleted_at IS NULL
      WHERE ba.deleted_at IS NULL
        AND ba.is_active = TRUE
      ORDER BY ba.account_name ASC
    `

    const result = await pool.query<BankAccountOption>(sql, [company_id])
    return result.rows
  }

  // ============================================
  // VALIDATION: check bank account exists & active
  // ============================================

  async validateBankAccount(bank_account_id: number): Promise<boolean> {
    const sql = `
      SELECT id FROM bank_accounts
      WHERE id = $1
        AND is_active = TRUE
        AND deleted_at IS NULL
      LIMIT 1
    `

    const result = await pool.query(sql, [bank_account_id])
    return result.rows.length > 0
  }

  // ============================================
  // BANK ACCOUNT BALANCES (Phase 2 placeholders)
  // ============================================

  async getOrCreatePeriodBalance(params: {
    company_id: string
    bank_account_id: number
    period_month: number
    period_year: number
  }): Promise<{
    id: string
    opening_balance: number
    total_masuk: number
    total_keluar: number
    closing_balance: number
    is_locked: boolean
  }> {
    const sql = `
      SELECT
        id,
        opening_balance::numeric,
        total_masuk::numeric,
        total_keluar::numeric,
        closing_balance::numeric,
        is_locked
      FROM bank_account_balances
      WHERE company_id = $1
        AND bank_account_id = $2
        AND period_month = $3
        AND period_year = $4
      LIMIT 1
    `

    const result = await pool.query(sql, [
      params.company_id,
      params.bank_account_id,
      params.period_month,
      params.period_year,
    ])

    if (result.rows.length === 0) {
      // Return default balance jika belum ada
      return {
        id: '',
        opening_balance: 0,
        total_masuk: 0,
        total_keluar: 0,
        closing_balance: 0,
        is_locked: false,
      }
    }

    const row = result.rows[0]
    return {
      id: row.id,
      opening_balance: Number(row.opening_balance),
      total_masuk: Number(row.total_masuk),
      total_keluar: Number(row.total_keluar),
      closing_balance: Number(row.closing_balance),
      is_locked: row.is_locked,
    }
  }

  // ============================================
  // BANK ACCOUNT: get previous month closing balance
  // ============================================

  async getPreviousMonthClosingBalance(params: {
    company_id: string
    bank_account_id: number
    period_month: number
    period_year: number
  }): Promise<number> {
    // Calculate previous month
    let prevMonth = params.period_month - 1
    let prevYear = params.period_year

    if (prevMonth < 1) {
      prevMonth = 12
      prevYear -= 1
    }

    const sql = `
      SELECT closing_balance::numeric
      FROM bank_account_balances
      WHERE company_id = $1
        AND bank_account_id = $2
        AND period_month = $3
        AND period_year = $4
      LIMIT 1
    `

    const result = await pool.query(sql, [
      params.company_id,
      params.bank_account_id,
      prevMonth,
      prevYear,
    ])

    if (result.rows.length === 0) {
      return 0
    }

    return Number(result.rows[0].closing_balance)
  }
}

export const bankVouchersRepository = new BankVouchersRepository()
