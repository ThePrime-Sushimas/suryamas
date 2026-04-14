import { pool } from "../../config/db";
import { logInfo, logError } from "../../config/logger";

/**
 * Auto-generate DRAFT bank voucher after reconciliation.
 * Called from: 1:1 reconcile, confirmAutoMatch, createSettlementGroup
 *
 * Groups aggregates by bank_date + bank_account_id → 1 voucher per group.
 * Skips if voucher already exists for the same aggregate.
 */
export async function generateDraftVouchersFromAggregates(params: {
  company_id: string;
  aggregate_ids: string[];
  bank_date: string;          // tanggal mutasi bank (settlement_date / statement date)
  source_type: "RECONCILIATION" | "SETTLEMENT_GROUP" | "MULTI_MATCH";
  user_id?: string;
}): Promise<string[]> {
  if (params.aggregate_ids.length === 0) return [];

  try {
    // 1. Fetch aggregate details with payment method + bank info
    const aggSql = `
      SELECT
        at.id AS aggregate_id,
        at.transaction_date::date AS transaction_date,
        at.branch_id,
        COALESCE(at.branch_name, br.branch_name) AS branch_name,
        pm.id AS payment_method_id,
        pm.name AS payment_method_name,
        pm.bank_account_id,
        ba.account_name AS bank_account_name,
        ba.account_number AS bank_account_number,
        pm.coa_account_id,
        pm.fee_coa_account_id,
        at.gross_amount::numeric,
        at.tax_amount::numeric,
        at.actual_nett_amount::numeric,
        at.actual_fee_amount::numeric,
        at.fee_discrepancy::numeric
      FROM aggregated_transactions at
      JOIN payment_methods pm ON pm.id = at.payment_method_id
      LEFT JOIN bank_accounts ba ON ba.id = pm.bank_account_id
      LEFT JOIN branches br ON br.id = at.branch_id
      WHERE at.id = ANY($1)
        AND at.deleted_at IS NULL
    `;
    const aggResult = await pool.query(aggSql, [params.aggregate_ids]);
    if (aggResult.rows.length === 0) return [];

    // 2. Group by bank_account_id (1 voucher per bank account)
    const byBank = new Map<number, typeof aggResult.rows>();
    for (const row of aggResult.rows) {
      if (!row.bank_account_id) continue;
      const key = row.bank_account_id;
      if (!byBank.has(key)) byBank.set(key, []);
      byBank.get(key)!.push(row);
    }

    const createdNumbers: string[] = [];
    const bankDate = params.bank_date;
    const bankDateObj = new Date(bankDate);
    const periodMonth = bankDateObj.getMonth() + 1;
    const periodYear = bankDateObj.getFullYear();

    // 3. Create 1 DRAFT voucher per bank account
    for (const [bankAccountId, rows] of byBank) {
      // Filter out aggregates that already have an active voucher
      const existCheck = await pool.query(`
        SELECT bvl.aggregate_id FROM bank_voucher_lines bvl
        JOIN bank_vouchers bv ON bv.id = bvl.voucher_id
        WHERE bvl.aggregate_id = ANY($1)
          AND bv.deleted_at IS NULL AND bv.status != 'VOID'
      `, [rows.map((r: any) => r.aggregate_id)]);

      const alreadyVouchered = new Set(existCheck.rows.map((r: any) => r.aggregate_id));
      const rowsToProcess = rows.filter((r: any) => !alreadyVouchered.has(r.aggregate_id));

      if (rowsToProcess.length === 0) continue;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Generate voucher number
        const numResult = await client.query(
          "SELECT generate_bank_voucher_number($1, $2, $3) as num",
          [params.company_id, "BM", bankDate]
        );
        const voucherNumber = numResult.rows[0].num;

        // Build lines
        let lineNumber = 0;
        let totalGross = 0, totalTax = 0, totalFee = 0, totalNett = 0;
        const lineValues: any[][] = [];

        for (const row of rowsToProcess) {
          const gross = Number(row.gross_amount);
          const tax = Number(row.tax_amount);
          const nett = Number(row.actual_nett_amount);
          const fee = Number(row.actual_fee_amount) + Number(row.fee_discrepancy);

          // Main line
          lineNumber++;
          totalGross += gross;
          totalTax += tax;
          totalNett += nett;
          lineValues.push([
            lineNumber, row.aggregate_id, params.source_type,
            row.payment_method_id, row.payment_method_name,
            row.bank_account_id, row.bank_account_name, row.bank_account_number,
            row.payment_method_name.toUpperCase(), false,
            gross, tax, fee, nett,
            row.coa_account_id, row.fee_coa_account_id,
            row.transaction_date,
          ]);

          // Fee line
          if (fee !== 0) {
            lineNumber++;
            totalFee += Math.abs(fee);
            const feeDesc = fee > 0
              ? `BIAYA ADMIN ${row.payment_method_name.toUpperCase()}`
              : `LEBIH ${row.payment_method_name.toUpperCase()}`;
            lineValues.push([
              lineNumber, row.aggregate_id, params.source_type,
              row.payment_method_id, row.payment_method_name,
              row.bank_account_id, row.bank_account_name, row.bank_account_number,
              feeDesc, true,
              0, 0, fee, -fee,
              row.coa_account_id, row.fee_coa_account_id,
              row.transaction_date,
            ]);
          }
        }

        const firstRow = rowsToProcess[0];

        // Insert header as DRAFT
        const headerResult = await client.query(`
          INSERT INTO bank_vouchers (
            company_id, voucher_type, voucher_number, transaction_date, bank_date,
            period_month, period_year, branch_id, branch_name, bank_account_id,
            total_gross, total_tax, total_fee, total_nett, description,
            status, created_by, updated_by
          ) VALUES (
            $1, 'BM', $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14,
            'DRAFT', $15, $15
          ) RETURNING id
        `, [
          params.company_id, voucherNumber,
          firstRow.transaction_date, bankDate,
          periodMonth, periodYear,
          firstRow.branch_id, firstRow.branch_name, bankAccountId,
          totalGross, totalTax, totalFee, totalNett - totalFee,
          `Draft Voucher Bank Masuk ${bankDate}`,
          params.user_id,
        ]);
        const voucherId = headerResult.rows[0].id;

        // Insert lines
        for (const lv of lineValues) {
          await client.query(`
            INSERT INTO bank_voucher_lines (
              voucher_id, line_number, aggregate_id, source_type,
              payment_method_id, payment_method_name,
              bank_account_id, bank_account_name, bank_account_number,
              description, is_fee_line,
              gross_amount, tax_amount, actual_fee_amount, nett_amount,
              coa_account_id, fee_coa_account_id, transaction_date
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          `, [voucherId, ...lv]);
        }

        await client.query("COMMIT");
        createdNumbers.push(voucherNumber);

        logInfo("Draft voucher auto-generated", {
          voucher_number: voucherNumber,
          bank_account_id: bankAccountId,
          aggregate_count: rowsToProcess.length,
          source_type: params.source_type,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    return createdNumbers;
  } catch (error) {
    logError("Failed to auto-generate draft vouchers", {
      aggregate_ids: params.aggregate_ids,
      error: error instanceof Error ? error.message : error,
    });
    // Don't throw — voucher generation failure should not block reconciliation
    return [];
  }
}
