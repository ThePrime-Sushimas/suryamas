import { pool } from "../../config/db";
import type {
  AggregatedVoucherRow,
  BankAccountOption,
} from "./bank-vouchers.types";
import { BankVoucherInvalidBankAccountError } from "./bank-vouchers.errors";
import { logInfo } from "../../config/logger";

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
    company_id: string;
    branch_id?: string;
    date_start: string; // 'YYYY-MM-DD'
    date_end: string; // 'YYYY-MM-DD'
    bank_account_id?: number;
  }): Promise<AggregatedVoucherRow[]> {
    const values: unknown[] = [
      params.company_id,
      params.date_start,
      params.date_end,
    ];
    let paramIndex = 4;

    const conditions: string[] = [
      "at.deleted_at IS NULL",
      "at.is_reconciled = TRUE",
      "at.superseded_by IS NULL", // exclude versi lama yang sudah digantikan
      "pm.bank_account_id IS NOT NULL", // hanya payment method yang punya mapping bank
      "pm.deleted_at IS NULL",
      "ba.deleted_at IS NULL",
      // filter company via branch
      "br.company_id = $1",
      "at.transaction_date::date BETWEEN $2 AND $3",
    ];

    if (params.branch_id) {
      conditions.push(`at.branch_id = $${paramIndex}`);
      values.push(params.branch_id);
      paramIndex++;
    }

    if (params.bank_account_id) {
      conditions.push(`pm.bank_account_id = $${paramIndex}`);
      values.push(params.bank_account_id);
      paramIndex++;
    }

    const whereClause = conditions
      .map((c) => `  AND ${c}`)
      .join("\n")
      .replace(/^  AND /, "WHERE ");

    const sql = `
      SELECT
        at.transaction_date::date                   AS transaction_date,
        pm.bank_account_id,
        ba.account_name                             AS bank_account_name,
        ba.account_number                           AS bank_account_number,
        pm.id                                       AS payment_method_id,
        pm.name                                     AS payment_method_name,
        pm.payment_type,
        pm.coa_account_id,
        pm.fee_coa_account_id,
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
        at.transaction_date::date,
        pm.bank_account_id,
        ba.account_name,
        ba.account_number,
        pm.id,
        pm.name,
        pm.payment_type,
        pm.coa_account_id,
        pm.fee_coa_account_id,
        at.branch_id,
        COALESCE(at.branch_name, br.branch_name)
      ORDER BY
        at.transaction_date::date ASC,
        pm.bank_account_id ASC,
        pm.name ASC
    `;

    const result = await pool.query<AggregatedVoucherRow>(sql, values);

    // Add logging for debugging
    logInfo("RECONCILED AGGREGATES QUERY RESULT", {
      params: {
        ...params,
        company_id: params.company_id.substring(0, 8) + "...",
      },
      rows_count: result.rows.length,
      first_row_date:
        result.rows.length > 0 ? result.rows[0].transaction_date : null,
    });

    return result.rows;
  }

  // ============================================
  // SUMMARY: total per bank per period
  // ============================================

  async getPeriodSummaryByBank(params: {
    company_id: string;
    branch_id?: string;
    date_start: string;
    date_end: string;
  }): Promise<
    {
      bank_account_id: number;
      bank_account_name: string;
      total_nett: string;
      total_fee: string;
    }[]
  > {
    const values: unknown[] = [
      params.company_id,
      params.date_start,
      params.date_end,
    ];
    let paramIndex = 4;

    let branchFilter = "";
    if (params.branch_id) {
      branchFilter = `AND at.branch_id = $${paramIndex}`;
      values.push(params.branch_id);
      paramIndex++;
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
    `;

    const result = await pool.query(sql, values);
    return result.rows;
  }

  // ============================================
  // SUMMARY: total per day (untuk running balance)
  // ============================================

  async getDailySummary(params: {
    company_id: string;
    branch_id?: string;
    date_start: string;
    date_end: string;
  }): Promise<
    {
      transaction_date: Date;
      total_nett: string;
      total_fee: string;
    }[]
  > {
    const values: unknown[] = [
      params.company_id,
      params.date_start,
      params.date_end,
    ];
    let paramIndex = 4;

    let branchFilter = "";
    if (params.branch_id) {
      branchFilter = `AND at.branch_id = $${paramIndex}`;
      values.push(params.branch_id);
      paramIndex++;
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
    `;

    const result = await pool.query(sql, values);
    return result.rows;
  }

  // ============================================
  // DROPDOWN: bank accounts untuk filter
  // ============================================

  async getBankAccountsByCompany(
    company_id: string,
  ): Promise<BankAccountOption[]> {
    // bank_accounts yang punya mapping ke payment_methods aktif di company ini
    const sql = `
      SELECT DISTINCT
        ba.id,
        ba.account_name,
        ba.account_number,
        COALESCE(b.bank_name, ba.account_name) AS bank_name
      FROM bank_accounts ba
      JOIN payment_methods pm
        ON pm.bank_account_id = ba.id
       AND pm.company_id = $1
       AND pm.deleted_at IS NULL
      LEFT JOIN banks b ON b.id = ba.bank_id
      WHERE ba.deleted_at IS NULL
        AND ba.is_active = TRUE
      ORDER BY ba.account_name ASC
    `;

    const result = await pool.query<BankAccountOption>(sql, [company_id]);
    return result.rows;
  }

  // ============================================
  // GET VOUCHER BY ID (for print / detail)
  // Joins: company, bank_account, lines + COA codes
  // ============================================

  async getVoucherById(voucherId: string): Promise<any | null> {
    const sql = `
      SELECT
        bv.*,
        c.company_name,
        c.npwp AS company_npwp,
        ba.account_name AS bank_account_name,
        ba.account_number AS bank_account_number,
        uc.raw_user_meta_data->>'full_name' AS created_by_name,
        uconf.raw_user_meta_data->>'full_name' AS confirmed_by_name
      FROM bank_vouchers bv
      JOIN companies c ON c.id = bv.company_id
      JOIN bank_accounts ba ON ba.id = bv.bank_account_id
      LEFT JOIN auth.users uc ON uc.id = bv.created_by
      LEFT JOIN auth.users uconf ON uconf.id = bv.confirmed_by
      WHERE bv.id = $1
        AND bv.deleted_at IS NULL
      LIMIT 1
    `;
    const header = await pool.query(sql, [voucherId]);
    if (header.rows.length === 0) return null;

    const linesSql = `
      SELECT
        bvl.*,
        coa.account_code AS coa_code,
        fcoa.account_code AS fee_coa_code
      FROM bank_voucher_lines bvl
      LEFT JOIN chart_of_accounts coa ON coa.id = bvl.coa_account_id
      LEFT JOIN chart_of_accounts fcoa ON fcoa.id = bvl.fee_coa_account_id
      WHERE bvl.voucher_id = $1
      ORDER BY bvl.line_number ASC
    `;
    const lines = await pool.query(linesSql, [voucherId]);

    return { ...header.rows[0], lines: lines.rows };
  }

  // ============================================
  // DROPDOWN: payment methods with COA for manual voucher
  // ============================================

  async getPaymentMethodsForVoucher(
    company_id: string,
  ): Promise<Array<{
    id: number;
    code: string;
    name: string;
    payment_type: string;
    bank_account_id: number | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_name: string | null;
    coa_account_id: string | null;
    coa_code: string | null;
    fee_coa_account_id: string | null;
    fee_coa_code: string | null;
  }>> {
    const sql = `
      SELECT
        pm.id, pm.code, pm.name, pm.payment_type,
        pm.bank_account_id,
        ba.account_name AS bank_account_name,
        ba.account_number AS bank_account_number,
        b.bank_name,
        pm.coa_account_id,
        coa.account_code AS coa_code,
        pm.fee_coa_account_id,
        fcoa.account_code AS fee_coa_code
      FROM payment_methods pm
      LEFT JOIN bank_accounts ba ON ba.id = pm.bank_account_id
      LEFT JOIN banks b ON b.id = ba.bank_id
      LEFT JOIN chart_of_accounts coa ON coa.id = pm.coa_account_id
      LEFT JOIN chart_of_accounts fcoa ON fcoa.id = pm.fee_coa_account_id
      WHERE pm.company_id = $1
        AND pm.is_active = TRUE
        AND pm.deleted_at IS NULL
      ORDER BY pm.sort_order ASC, pm.name ASC
    `;
    const result = await pool.query(sql, [company_id]);
    return result.rows;
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
    `;

    const result = await pool.query(sql, [bank_account_id]);
    return result.rows.length > 0;
  }

  // ============================================
  // OPENING BALANCES: get all banks for a period
  // ============================================

  async getOpeningBalancesByPeriod(params: {
    company_id: string;
    period_month: number;
    period_year: number;
  }): Promise<Array<{ bank_account_id: number; opening_balance: number }>> {
    const sql = `
      SELECT bank_account_id, opening_balance::numeric
      FROM bank_account_balances
      WHERE company_id = $1
        AND period_month = $2
        AND period_year = $3
    `;
    const result = await pool.query(sql, [
      params.company_id, params.period_month, params.period_year,
    ]);
    return result.rows.map(r => ({
      bank_account_id: r.bank_account_id,
      opening_balance: Number(r.opening_balance),
    }));
  }

  // ============================================
  // BANK ACCOUNT BALANCES
  // ============================================

  async getOrCreatePeriodBalance(params: {
    company_id: string;
    bank_account_id: number;
    period_month: number;
    period_year: number;
  }): Promise<{
    id: string;
    opening_balance: number;
    total_masuk: number;
    total_keluar: number;
    closing_balance: number;
    is_locked: boolean;
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
    `;

    const result = await pool.query(sql, [
      params.company_id,
      params.bank_account_id,
      params.period_month,
      params.period_year,
    ]);

    if (result.rows.length === 0) {
      // Return default balance jika belum ada
      return {
        id: "",
        opening_balance: 0,
        total_masuk: 0,
        total_keluar: 0,
        closing_balance: 0,
        is_locked: false,
      };
    }

    const row = result.rows[0];
    return {
      id: row.id,
      opening_balance: Number(row.opening_balance),
      total_masuk: Number(row.total_masuk),
      total_keluar: Number(row.total_keluar),
      closing_balance: Number(row.closing_balance),
      is_locked: row.is_locked,
    };
  }

  // ============================================
  // BANK ACCOUNT: get previous month closing balance
  // ============================================

  async getPreviousMonthClosingBalance(params: {
    company_id: string;
    bank_account_id: number;
    period_month: number;
    period_year: number;
  }): Promise<number> {
    // Calculate previous month
    let prevMonth = params.period_month - 1;
    let prevYear = params.period_year;

    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const sql = `
      SELECT closing_balance::numeric
      FROM bank_account_balances
      WHERE company_id = $1
        AND bank_account_id = $2
        AND period_month = $3
        AND period_year = $4
      LIMIT 1
    `;

    const result = await pool.query(sql, [
      params.company_id,
      params.bank_account_id,
      prevMonth,
      prevYear,
    ]);

    if (result.rows.length === 0) {
      return 0;
    }

    return Number(result.rows[0].closing_balance);
  }
  // ============================================
  // PERSISTENCE: Create Voucher (Header + Lines)
  // Supports both auto-confirm and manual draft
  // ============================================

  async createVoucher(params: {
    company_id: string;
    voucher_type: "BM" | "BK";
    transaction_date: string;
    bank_date: string;
    period_month: number;
    period_year: number;
    branch_id?: string;
    branch_name?: string;
    bank_account_id: number;
    total_gross: number;
    total_tax: number;
    total_fee: number;
    total_nett: number;
    description: string;
    notes?: string;
    is_manual?: boolean;
    status?: string;
    created_by?: string;
    lines: Array<{
      line_number: number;
      aggregate_id?: string;
      source_type: string;
      payment_method_id?: number;
      payment_method_name?: string;
      bank_account_id: number;
      bank_account_name: string;
      bank_account_number?: string;
      description: string;
      is_fee_line: boolean;
      gross_amount: number;
      tax_amount: number;
      actual_fee_amount: number;
      nett_amount: number;
      coa_account_id?: string;
      fee_coa_account_id?: string;
      transaction_date: string;
      is_manual?: boolean;
    }>;
  }): Promise<{ voucher_number: string; voucher_id: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const numResult = await client.query(
        "SELECT generate_bank_voucher_number($1, $2, $3) as num",
        [params.company_id, params.voucher_type, params.bank_date],
      );
      const voucherNumber = numResult.rows[0].num;
      const status = params.status || 'CONFIRMED';
      const isConfirmed = status === 'CONFIRMED';

      const headerSql = `
        INSERT INTO bank_vouchers (
          company_id, voucher_type, voucher_number, transaction_date, bank_date,
          period_month, period_year, branch_id, branch_name, bank_account_id,
          total_gross, total_tax, total_fee, total_nett, description, notes,
          is_manual, status,
          confirmed_at, confirmed_by, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18,
          ${isConfirmed ? 'NOW()' : 'NULL'}, ${isConfirmed ? '$19' : 'NULL'}, $19, $19
        ) RETURNING id
      `;
      const headerResult = await client.query(headerSql, [
        params.company_id,
        params.voucher_type,
        voucherNumber,
        params.transaction_date,
        params.bank_date,
        params.period_month,
        params.period_year,
        params.branch_id,
        params.branch_name,
        params.bank_account_id,
        params.total_gross,
        params.total_tax,
        params.total_fee,
        params.total_nett,
        params.description,
        params.notes || null,
        params.is_manual || false,
        status,
        params.created_by,
      ]);
      const voucherId = headerResult.rows[0].id;

      for (const line of params.lines) {
        const lineSql = `
          INSERT INTO bank_voucher_lines (
            voucher_id, line_number, aggregate_id, source_type,
            payment_method_id, payment_method_name, bank_account_id,
            bank_account_name, bank_account_number, description,
            is_fee_line, gross_amount, tax_amount, actual_fee_amount,
            nett_amount, coa_account_id, fee_coa_account_id, transaction_date, is_manual
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
        `;
        await client.query(lineSql, [
          voucherId,
          line.line_number,
          line.aggregate_id || null,
          line.source_type,
          line.payment_method_id || null,
          line.payment_method_name || null,
          line.bank_account_id,
          line.bank_account_name,
          line.bank_account_number || null,
          line.description,
          line.is_fee_line,
          line.gross_amount,
          line.tax_amount,
          line.actual_fee_amount,
          line.nett_amount,
          line.coa_account_id || null,
          line.fee_coa_account_id || null,
          line.transaction_date,
          line.is_manual || false,
        ]);
      }

      await client.query("COMMIT");
      return { voucher_number: voucherNumber, voucher_id: voucherId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // VOID: soft-void a voucher
  // ============================================

  async voidVoucher(params: {
    voucher_id: string;
    reason: string;
    user_id?: string;
  }): Promise<void> {
    const sql = `
      UPDATE bank_vouchers SET
        status = 'VOID',
        voided_at = NOW(),
        voided_by = $2,
        void_reason = $3,
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $1
        AND deleted_at IS NULL
        AND status != 'VOID'
    `;
    await pool.query(sql, [params.voucher_id, params.user_id, params.reason]);
  }

  // ============================================
  // OPENING BALANCE: upsert
  // ============================================

  async upsertOpeningBalance(params: {
    company_id: string;
    bank_account_id: number;
    period_month: number;
    period_year: number;
    opening_balance: number;
    user_id?: string;
  }): Promise<{ id: string; opening_balance: number; closing_balance: number }> {
    const sql = `
      INSERT INTO bank_account_balances (
        company_id, bank_account_id, period_month, period_year,
        opening_balance, is_manual_opening, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $6)
      ON CONFLICT (company_id, bank_account_id, period_month, period_year)
      DO UPDATE SET
        opening_balance = $5,
        is_manual_opening = true,
        updated_by = $6,
        updated_at = NOW()
      WHERE NOT bank_account_balances.is_locked
      RETURNING id, opening_balance::numeric, closing_balance::numeric
    `;
    const result = await pool.query(sql, [
      params.company_id,
      params.bank_account_id,
      params.period_month,
      params.period_year,
      params.opening_balance,
      params.user_id,
    ]);
    if (result.rows.length === 0) {
      throw new Error('Period is locked, cannot update opening balance');
    }
    const row = result.rows[0];
    return {
      id: row.id,
      opening_balance: Number(row.opening_balance),
      closing_balance: Number(row.closing_balance),
    };
  }

  // ============================================
  // LIST: confirmed vouchers by period
  // ============================================

  async listVouchersByPeriod(params: {
    company_id: string;
    period_month: number;
    period_year: number;
    branch_id?: string;
    bank_account_id?: number;
    status?: string;
  }): Promise<any[]> {
    const values: unknown[] = [params.company_id, params.period_month, params.period_year];
    let paramIndex = 4;
    const filters: string[] = [];

    if (params.branch_id) {
      filters.push(`bv.branch_id = $${paramIndex}`);
      values.push(params.branch_id);
      paramIndex++;
    }
    if (params.bank_account_id) {
      filters.push(`bv.bank_account_id = $${paramIndex}`);
      values.push(params.bank_account_id);
      paramIndex++;
    }
    if (params.status) {
      filters.push(`bv.status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    const extraWhere = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

    const sql = `
      SELECT
        bv.id, bv.voucher_number, bv.voucher_type, bv.status,
        bv.transaction_date, bv.bank_date, bv.bank_account_id,
        ba.account_name AS bank_account_name,
        bv.branch_name, bv.is_manual,
        bv.total_gross::numeric, bv.total_tax::numeric,
        bv.total_fee::numeric, bv.total_nett::numeric,
        bv.description, bv.confirmed_at, bv.created_at
      FROM bank_vouchers bv
      JOIN bank_accounts ba ON ba.id = bv.bank_account_id
      WHERE bv.company_id = $1
        AND bv.period_month = $2
        AND bv.period_year = $3
        AND bv.deleted_at IS NULL
        ${extraWhere}
      ORDER BY bv.bank_date ASC, bv.voucher_number ASC
    `;
    const result = await pool.query(sql, values);
    return result.rows;
  }

  // ============================================
  // CHECK: Existing confirmed vouchers
  // ============================================

  async getConfirmedVouchersByPeriod(params: {
    company_id: string;
    date_start: string;
    date_end: string;
    branch_id?: string;
  }): Promise<
    Array<{
      transaction_date: Date;
      bank_account_id: number;
      status: string;
      voucher_number: string;
    }>
  > {
    const values: unknown[] = [
      params.company_id,
      params.date_start,
      params.date_end,
    ];
    let branchFilter = "";
    if (params.branch_id) {
      branchFilter = "AND branch_id = $4";
      values.push(params.branch_id);
    }

    const sql = `
      SELECT transaction_date, bank_account_id, status, voucher_number
      FROM bank_vouchers
      WHERE company_id = $1
        AND transaction_date BETWEEN $2 AND $3
        AND deleted_at IS NULL
        ${branchFilter}
    `;

    const result = await pool.query(sql, values);
    return result.rows;
  }
}

export const bankVouchersRepository = new BankVouchersRepository();
