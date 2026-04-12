import { pool } from '../../config/db'           // sesuaikan path ke db pool kamu
import type { AggregatedVoucherRow, BankAccountOption } from './bank-vouchers.types'

export class BankVouchersRepository {

  // ============================================
  // MAIN: fetch reconciled aggregates per period
  // Grouped by: transaction_date + bank_account + payment_method
  // Includes fee (actual_fee_amount + fee_discrepancy = real fee yang masuk bank)
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
      // filter company via branch (karena aggregated_transactions tidak punya company_id langsung)
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
        SUM(at.actual_nett_amount)                   AS nett_amount,
        -- Fee: actual yang terjadi (termasuk discrepancy sesuai requirement)
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
        SUM(at.actual_nett_amount)                          AS total_nett,
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
        SUM(at.actual_nett_amount)                          AS total_nett,
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
        COALESCE(ba.bank_name, ba.account_name) AS bank_name
      FROM bank_accounts ba
      JOIN payment_methods pm
        ON pm.bank_account_id = ba.id
       AND pm.company_id = $1
       AND pm.deleted_at IS NULL
       AND pm.is_active = TRUE
      WHERE ba.deleted_at IS NULL
      ORDER BY ba.account_name ASC
    `

    const result = await pool.query<BankAccountOption>(sql, [company_id])
    return result.rows
  }

  // ============================================
  // VOUCHER NUMBER: get last sequence per type per period
  // (dipakai saat phase 2 — confirm/save voucher)
  // ============================================

  async getLastVoucherSequence(params: {
    company_id: string
    voucher_type: 'BM' | 'BK'
    period_month: number
    period_year: number
  }): Promise<number> {
    const sql = `
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(voucher_number FROM 7) AS INTEGER)
      ), 0) AS last_seq
      FROM bank_vouchers
      WHERE company_id = $1
        AND voucher_type = $2
        AND period_month = $3
        AND period_year = $4
        AND deleted_at IS NULL
    `
    const result = await pool.query(sql, [
      params.company_id,
      params.voucher_type,
      params.period_month,
      params.period_year,
    ])
    return Number(result.rows[0]?.last_seq ?? 0)
  }
}

export const bankVouchersRepository = new BankVouchersRepository()
