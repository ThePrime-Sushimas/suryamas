import { bankVouchersRepository } from "./bank-vouchers.repository";
import {
  generateVoucherNumber,
  getPeriodLabel,
  getPeriodDateRange,
  validatePeriod,
} from "./bank-vouchers.config";
import {
  BankVoucherNoPeriodDataError,
  BankVoucherMissingCompanyError,
  BankVoucherInvalidPeriodError,
  BankVoucherInvalidBankAccountError,
  BankVoucherNotFoundError,
  BankVoucherAlreadyConfirmedError,
  BankVoucherPeriodLockedError,
} from "./bank-vouchers.errors";
import type {
  BankVoucherPreviewParams,
  BankVoucherPreviewResult,
  BankVoucherSummaryParams,
  BankVoucherSummaryResult,
  VoucherDay,
  VoucherLine,
  AggregatedVoucherRow,
  BankAccountOption,
  VoucherPrintData,
  VoucherPrintLine,
} from "./bank-vouchers.types";
import type { BankVoucherManualCreateRequest } from "./bank-vouchers.schema";
import { logInfo, logError } from "../../config/logger";

/**
 * Bank Vouchers Service
 * Main business logic untuk bank vouchers system
 * Phase 1: Preview only (read-only, on-the-fly generation)
 * Phase 2: Confirm & persist ke database
 */
export class BankVouchersService {
  // ============================================
  // MAIN: PREVIEW on-the-fly
  // Tidak simpan ke DB — murni query + transform
  // ============================================

  async getPreview(
    params: BankVoucherPreviewParams,
  ): Promise<BankVoucherPreviewResult> {
    try {
      if (!params.company_id) {
        throw new BankVoucherMissingCompanyError();
      }

      // Validate period
      validatePeriod(params.period_month, params.period_year);

      const { start, end } = getPeriodDateRange(
        params.period_month,
        params.period_year,
      );
      const periodLabel = getPeriodLabel(
        params.period_month,
        params.period_year,
      );

      logInfo("Bank voucher preview started", {
        company_id: params.company_id,
        period: `${params.period_month}/${params.period_year}`,
        branch_id: params.branch_id,
      });

      const rows = await bankVouchersRepository.getReconciledAggregates({
        company_id: params.company_id,
        branch_id: params.branch_id,
        date_start: start,
        date_end: end,
        bank_account_id: params.bank_account_id,
      });

      if (rows.length === 0) {
        throw new BankVoucherNoPeriodDataError(periodLabel);
      }

      // Get confirmed vouchers list to mark them in preview
      const confirmedList = await bankVouchersRepository.getConfirmedVouchersByPeriod({
        company_id: params.company_id,
        date_start: start,
        date_end: end,
        branch_id: params.branch_id,
      });

      // Build voucher days (on-the-fly numbering)
      const vouchers = this.buildVoucherDays(
        rows,
        params.period_month,
        params.period_year,
        confirmedList
      );

      // Build summary
      const summary = this.buildSummary(vouchers);

      logInfo("Bank voucher preview completed", {
        company_id: params.company_id,
        total_vouchers: vouchers.length,
        total_nett: summary.total_nett,
      });

      return {
        period_month: params.period_month,
        period_year: params.period_year,
        period_label: periodLabel,
        company_id: params.company_id,
        branch_id: params.branch_id,
        vouchers,
        summary,
      };
    } catch (error) {
      logError("Bank voucher preview failed", error);
      throw error;
    }
  }

  // ============================================
  // SUMMARY: totals + running balance per day
  // ============================================

  async getSummary(
    params: BankVoucherSummaryParams,
  ): Promise<BankVoucherSummaryResult> {
    try {
      if (!params.company_id) {
        throw new BankVoucherMissingCompanyError();
      }

      validatePeriod(params.period_month, params.period_year);

      const { start, end } = getPeriodDateRange(
        params.period_month,
        params.period_year,
      );
      const periodLabel = getPeriodLabel(
        params.period_month,
        params.period_year,
      );

      const [byBankRows, byDayRows] = await Promise.all([
        bankVouchersRepository.getPeriodSummaryByBank({
          company_id: params.company_id,
          branch_id: params.branch_id,
          date_start: start,
          date_end: end,
        }),
        bankVouchersRepository.getDailySummary({
          company_id: params.company_id,
          branch_id: params.branch_id,
          date_start: start,
          date_end: end,
        }),
      ]);

      // Get opening balances for all banks in this period
      const openingBalances = await bankVouchersRepository.getOpeningBalancesByPeriod({
        company_id: params.company_id,
        period_month: params.period_month,
        period_year: params.period_year,
      });
      const obMap = new Map(openingBalances.map(ob => [ob.bank_account_id, ob.opening_balance]));
      const totalOpeningBalance = openingBalances.reduce((s, ob) => s + ob.opening_balance, 0);

      // By bank summary (with opening balance per bank)
      const by_bank = byBankRows.map((row) => {
        const totalMasuk = parseFloat(row.total_nett) || 0;
        const totalKeluar = 0;
        const ob = obMap.get(row.bank_account_id) || 0;
        return {
          bank_account_id: row.bank_account_id,
          bank_account_name: row.bank_account_name,
          opening_balance: ob,
          total_masuk: totalMasuk,
          total_keluar: totalKeluar,
          saldo: ob + totalMasuk - totalKeluar,
        };
      });

      // By date with running balance (starting from total opening balance)
      let runningBalance = totalOpeningBalance;
      const by_date = byDayRows.map((row) => {
        const totalMasuk = parseFloat(row.total_nett) || 0;
        const totalKeluar = 0;
        runningBalance += totalMasuk - totalKeluar;
        return {
          transaction_date: this.formatDate(row.transaction_date),
          total_masuk: totalMasuk,
          total_keluar: totalKeluar,
          saldo_harian: totalMasuk - totalKeluar,
          running_balance: runningBalance,
        };
      });

      const totalBankMasuk = by_bank.reduce((acc, b) => acc + b.total_masuk, 0);
      const totalBankKeluar = 0;

      return {
        period_label: periodLabel,
        opening_balance: totalOpeningBalance,
        total_bank_masuk: totalBankMasuk,
        total_bank_keluar: totalBankKeluar,
        saldo_berjalan: totalOpeningBalance + totalBankMasuk - totalBankKeluar,
        by_bank,
        by_date,
      };
    } catch (error) {
      logError("Bank voucher summary failed", error);
      throw error;
    }
  }
  // ============================================
  // ACTION: CONFIRM (Save to DB)
  // ============================================

  async confirmVouchers(params: {
    company_id: string;
    transaction_dates: string[];
    branch_id?: string;
    bank_account_id?: number;
    user_id?: string;
  }): Promise<{ total_confirmed: number; voucher_numbers: string[] }> {
    try {
      if (!params.company_id) {
        throw new BankVoucherMissingCompanyError();
      }

      // 1. Get current preview data for these dates
      // Find min and max date
      const sortedDates = [...params.transaction_dates].sort();
      const dateStart = sortedDates[0];
      const dateEnd = sortedDates[sortedDates.length - 1];

      logInfo("Re-fetching data for confirmation", {
        company_id: params.company_id,
        date_start: dateStart,
        date_end: dateEnd,
        branch_id: params.branch_id,
        bank_account_id: params.bank_account_id
      });

      const rows = await bankVouchersRepository.getReconciledAggregates({
        company_id: params.company_id,
        branch_id: params.branch_id,
        date_start: dateStart,
        date_end: dateEnd,
        bank_account_id: params.bank_account_id,
      });

      if (rows.length === 0) {
        const dateLabel = dateStart === dateEnd ? dateStart : `${dateStart} - ${dateEnd}`;
        throw new BankVoucherNoPeriodDataError(dateLabel);
      }

      // Get confirmed vouchers first to avoid double saving/unique constraint error
      const confirmedList = await bankVouchersRepository.getConfirmedVouchersByPeriod({
        company_id: params.company_id,
        date_start: dateStart,
        date_end: dateEnd,
        branch_id: params.branch_id,
      });

      // 2. Build official vouchers per bank account per day
      // (Using current month/year from dates)
      const targetMonth = new Date(dateStart).getMonth() + 1;
      const targetYear = new Date(dateStart).getFullYear();

      const voucherModels = this.buildVoucherDays(
        rows,
        targetMonth,
        targetYear,
        confirmedList
      );

      // Filter only requested dates AND non-confirmed ones
      const toConfirm = voucherModels.filter((v) => 
        params.transaction_dates.includes(v.transaction_date) && !v.is_confirmed
      );

      if (toConfirm.length === 0) {
        return { total_confirmed: 0, voucher_numbers: [] };
      }

      // 3. Save to DB one by one (or batch if repository supports it)
      const confirmedNumbers: string[] = [];
      for (const v of toConfirm) {
        const num = await bankVouchersRepository.createVoucher({
          company_id: params.company_id,
          voucher_type: v.voucher_type,
          transaction_date: v.transaction_date,
          bank_date: v.transaction_date,
          period_month: targetMonth,
          period_year: targetYear,
          branch_id: v.branch_id,
          branch_name: v.branch_name,
          bank_account_id: v.bank_account_id,
          total_gross: v.lines.filter(l => !l.is_fee_line).reduce((sum, l) => sum + l.gross_amount, 0),
          total_tax: v.lines.filter(l => !l.is_fee_line).reduce((sum, l) => sum + l.tax_amount, 0),
          total_fee: v.lines.filter(l => l.is_fee_line).reduce((sum, l) => sum + Math.abs(l.nett_amount), 0),
          total_nett: v.day_total,
          description: `Voucher Bank Masuk ${v.transaction_date}`,
          created_by: params.user_id,
          lines: v.lines.map(l => ({
            line_number: l.line_number,
            aggregate_id: l.aggregate_id,
            source_type: "RECONCILIATION" as const,
            payment_method_id: l.payment_method_id,
            payment_method_name: l.payment_method_name,
            bank_account_id: l.bank_account_id,
            bank_account_name: l.bank_account_name,
            bank_account_number: l.bank_account_number,
            description: l.description,
            is_fee_line: l.is_fee_line,
            gross_amount: l.gross_amount,
            tax_amount: l.tax_amount,
            actual_fee_amount: l.actual_fee_amount,
            nett_amount: l.nett_amount,
            coa_account_id: l.coa_account_id,
            fee_coa_account_id: l.fee_coa_account_id,
            transaction_date: v.transaction_date,
          })),
        });
        confirmedNumbers.push(num.voucher_number);
      }

      return {
        total_confirmed: confirmedNumbers.length,
        voucher_numbers: confirmedNumbers,
      };
    } catch (error) {
      logError("Bank voucher confirmation failed", error);
      throw error;
    }
  }

  // ============================================
  // DETAIL: get single voucher by ID
  // ============================================

  async getVoucherDetail(voucherId: string) {
    const row = await bankVouchersRepository.getVoucherById(voucherId);
    if (!row) throw new BankVoucherNotFoundError(voucherId);

    return {
      id: row.id,
      voucher_number: row.voucher_number,
      voucher_type: row.voucher_type,
      status: row.status,
      transaction_date: this.formatDate(row.transaction_date),
      bank_date: this.formatDate(row.bank_date),
      period_month: row.period_month,
      period_year: row.period_year,
      period_label: getPeriodLabel(row.period_month, row.period_year),
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      bank_account_id: row.bank_account_id,
      bank_account_name: row.bank_account_name,
      bank_account_number: row.bank_account_number,
      company_name: row.company_name,
      is_manual: row.is_manual,
      is_adjustment: row.is_adjustment,
      description: row.description,
      notes: row.notes,
      total_gross: Number(row.total_gross),
      total_tax: Number(row.total_tax),
      total_fee: Number(row.total_fee),
      total_nett: Number(row.total_nett),
      confirmed_at: row.confirmed_at,
      confirmed_by_name: row.confirmed_by_name,
      created_by_name: row.created_by_name,
      voided_at: row.voided_at,
      void_reason: row.void_reason,
      lines: row.lines.map((l: any) => ({
        id: l.id,
        line_number: l.line_number,
        description: l.description,
        payment_method_name: l.payment_method_name,
        is_fee_line: l.is_fee_line,
        gross_amount: Number(l.gross_amount),
        tax_amount: Number(l.tax_amount),
        actual_fee_amount: Number(l.actual_fee_amount),
        nett_amount: Number(l.nett_amount),
        coa_code: l.coa_code || null,
        fee_coa_code: l.fee_coa_code || null,
        source_type: l.source_type,
        aggregate_id: l.aggregate_id,
        transaction_date: l.transaction_date ? this.formatDate(l.transaction_date) : null,
        is_manual: l.is_manual,
      })),
    };
  }

  // ============================================
  // LIST: confirmed vouchers by period
  // ============================================

  async listVouchers(params: {
    company_id: string;
    period_month: number;
    period_year: number;
    branch_id?: string;
    bank_account_id?: number;
    status?: string;
  }) {
    if (!params.company_id) throw new BankVoucherMissingCompanyError();
    validatePeriod(params.period_month, params.period_year);

    const rows = await bankVouchersRepository.listVouchersByPeriod(params);
    return {
      period_label: getPeriodLabel(params.period_month, params.period_year),
      vouchers: rows.map((r: any) => ({
        ...r,
        transaction_date: this.formatDate(r.transaction_date),
        bank_date: this.formatDate(r.bank_date),
        total_gross: Number(r.total_gross),
        total_tax: Number(r.total_tax),
        total_fee: Number(r.total_fee),
        total_nett: Number(r.total_nett),
      })),
      total: rows.length,
    };
  }

  // ============================================
  // MANUAL CREATE: user-created voucher
  // ============================================

  async createManualVoucher(params: {
    company_id: string;
    user_id?: string;
    data: BankVoucherManualCreateRequest;
  }) {
    if (!params.company_id) throw new BankVoucherMissingCompanyError();

    const bankDate = new Date(params.data.bank_date);
    const periodMonth = bankDate.getMonth() + 1;
    const periodYear = bankDate.getFullYear();
    validatePeriod(periodMonth, periodYear);

    const bankValid = await bankVouchersRepository.validateBankAccount(params.data.bank_account_id);
    if (!bankValid) throw new BankVoucherInvalidBankAccountError(params.data.bank_account_id);

    const balance = await bankVouchersRepository.getOrCreatePeriodBalance({
      company_id: params.company_id,
      bank_account_id: params.data.bank_account_id,
      period_month: periodMonth,
      period_year: periodYear,
    });
    if (balance.is_locked) {
      throw new BankVoucherPeriodLockedError(getPeriodLabel(periodMonth, periodYear));
    }

    const nonFeeLines = params.data.lines.filter(l => !l.is_fee_line);
    const feeLines = params.data.lines.filter(l => l.is_fee_line);
    const totalGross = nonFeeLines.reduce((s, l) => s + l.gross_amount, 0);
    const totalTax = nonFeeLines.reduce((s, l) => s + l.tax_amount, 0);
    const totalFee = feeLines.reduce((s, l) => s + Math.abs(l.nett_amount), 0);
    const totalNett = params.data.lines.reduce((s, l) => s + l.nett_amount, 0);

    const result = await bankVouchersRepository.createVoucher({
      company_id: params.company_id,
      voucher_type: params.data.voucher_type,
      transaction_date: params.data.bank_date,
      bank_date: params.data.bank_date,
      period_month: periodMonth,
      period_year: periodYear,
      branch_id: params.data.branch_id,
      bank_account_id: params.data.bank_account_id,
      total_gross: totalGross,
      total_tax: totalTax,
      total_fee: totalFee,
      total_nett: totalNett,
      description: params.data.description || `Manual Voucher ${params.data.bank_date}`,
      notes: params.data.notes,
      is_manual: true,
      status: 'CONFIRMED',
      created_by: params.user_id,
      lines: params.data.lines.map((l, idx) => ({
        line_number: idx + 1,
        source_type: 'MANUAL' as const,
        bank_account_id: l.bank_account_id,
        bank_account_name: l.bank_account_name,
        bank_account_number: l.bank_account_number,
        payment_method_id: l.payment_method_id,
        payment_method_name: l.payment_method_name,
        description: l.description,
        is_fee_line: l.is_fee_line,
        gross_amount: l.gross_amount,
        tax_amount: l.tax_amount,
        actual_fee_amount: l.actual_fee_amount,
        nett_amount: l.nett_amount,
        coa_account_id: l.coa_account_id,
        fee_coa_account_id: l.fee_coa_account_id,
        transaction_date: l.transaction_date || params.data.bank_date,
        is_manual: true,
      })),
    });

    logInfo("Manual voucher created", { voucher_number: result.voucher_number });
    return result;
  }

  // ============================================
  // VOID: void a confirmed voucher
  // ============================================

  async voidVoucher(params: {
    company_id: string;
    voucher_id: string;
    reason: string;
    user_id?: string;
  }) {
    if (!params.company_id) throw new BankVoucherMissingCompanyError();

    const voucher = await bankVouchersRepository.getVoucherById(params.voucher_id);
    if (!voucher) throw new BankVoucherNotFoundError(params.voucher_id);
    if (voucher.status === 'VOID') throw new BankVoucherAlreadyConfirmedError(voucher.voucher_number);
    if (voucher.status === 'JOURNALED') {
      throw new BankVoucherPeriodLockedError('Cannot void journaled voucher');
    }

    await bankVouchersRepository.voidVoucher({
      voucher_id: params.voucher_id,
      reason: params.reason,
      user_id: params.user_id,
    });

    logInfo("Voucher voided", { voucher_number: voucher.voucher_number, reason: params.reason });
    return { voucher_number: voucher.voucher_number, status: 'VOID' };
  }

  // ============================================
  // OPENING BALANCE: set/get
  // ============================================

  async setOpeningBalance(params: {
    company_id: string;
    bank_account_id: number;
    period_month: number;
    period_year: number;
    opening_balance: number;
    user_id?: string;
  }) {
    if (!params.company_id) throw new BankVoucherMissingCompanyError();
    validatePeriod(params.period_month, params.period_year);

    const bankValid = await bankVouchersRepository.validateBankAccount(params.bank_account_id);
    if (!bankValid) throw new BankVoucherInvalidBankAccountError(params.bank_account_id);

    return bankVouchersRepository.upsertOpeningBalance(params);
  }

  async getOpeningBalance(params: {
    company_id: string;
    bank_account_id: number;
    period_month: number;
    period_year: number;
  }) {
    if (!params.company_id) throw new BankVoucherMissingCompanyError();
    validatePeriod(params.period_month, params.period_year);

    const balance = await bankVouchersRepository.getOrCreatePeriodBalance(params);
    const prevClosing = await bankVouchersRepository.getPreviousMonthClosingBalance(params);

    return {
      ...balance,
      previous_month_closing: prevClosing,
      period_label: getPeriodLabel(params.period_month, params.period_year),
    };
  }

  // ============================================
  // PRINT: get voucher data for printing
  // ============================================

  async getVoucherPrintData(voucherId: string): Promise<VoucherPrintData> {
    const row = await bankVouchersRepository.getVoucherById(voucherId);
    if (!row) throw new BankVoucherNotFoundError(voucherId);

    const periodLabel = getPeriodLabel(row.period_month, row.period_year);
    const typeLabel = row.voucher_type === "BM" ? "Bank Masuk" : "Bank Keluar";

    const lines: VoucherPrintLine[] = row.lines.map((l: any) => ({
      line_number: l.line_number,
      payment_method_name: l.payment_method_name || "-",
      description: l.description,
      is_fee_line: l.is_fee_line,
      gross_amount: Number(l.gross_amount),
      tax_amount: Number(l.tax_amount),
      nett_amount: Number(l.nett_amount),
      actual_fee_amount: Number(l.actual_fee_amount),
      coa_code: l.is_fee_line ? (l.fee_coa_code || null) : (l.coa_code || null),
      fee_coa_code: l.fee_coa_code || null,
      reference: l.aggregate_id
        ? `${l.source_type === "SETTLEMENT_GROUP" ? "SG" : "RC"}#${String(l.aggregate_id).slice(0, 8)}`
        : null,
      source_type: l.source_type,
      transaction_date: l.transaction_date ? this.formatDate(l.transaction_date) : null,
    }));

    return {
      voucher_number: row.voucher_number,
      voucher_type: row.voucher_type,
      voucher_type_label: typeLabel,
      status: row.status,
      transaction_date: this.formatDate(row.transaction_date),
      bank_date: this.formatDate(row.bank_date),
      period_label: periodLabel,
      branch_name: row.branch_name,
      bank_account_name: row.bank_account_name,
      bank_account_number: row.bank_account_number,
      company_name: row.company_name,
      company_npwp: row.company_npwp,
      description: row.description,
      notes: row.notes,
      is_manual: row.is_manual,
      total_gross: Number(row.total_gross),
      total_tax: Number(row.total_tax),
      total_fee: Number(row.total_fee),
      total_nett: Number(row.total_nett),
      lines,
      created_by_name: row.created_by_name,
      confirmed_by_name: row.confirmed_by_name,
      confirmed_at: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
      printed_at: new Date().toISOString(),
    };
  }

  // ============================================
  // PRINT: generate HTML for browser printing
  // ============================================

  generatePrintHtml(data: VoucherPrintData): string {
    const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 0 });
    const fmtDate = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${day}-${m}-${y}`;
    };

    const lineRows = data.lines.map(l => `
      <tr class="${l.is_fee_line ? 'fee-row' : ''}">
        <td class="center">${l.line_number}</td>
        <td>${l.description}</td>
        <td>${l.payment_method_name}</td>
        <td class="right">${l.is_fee_line ? '-' : fmt(l.gross_amount)}</td>
        <td class="right">${l.is_fee_line ? '-' : fmt(l.tax_amount)}</td>
        <td class="right">${fmt(l.actual_fee_amount)}</td>
        <td class="right bold">${fmt(l.nett_amount)}</td>
        <td class="mono">${l.coa_code || '-'}</td>
        <td class="mono small">${l.reference || '-'}</td>
      </tr>
    `).join("");

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Voucher ${data.voucher_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #222; padding: 20px; }
  .voucher { max-width: 900px; margin: 0 auto; border: 2px solid #333; }
  .header { padding: 12px 16px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; }
  .header-left h1 { font-size: 16px; margin-bottom: 2px; }
  .header-left .sub { font-size: 10px; color: #555; }
  .header-right { text-align: right; }
  .header-right .vnum { font-size: 18px; font-weight: bold; font-family: monospace; }
  .header-right .status { display: inline-block; padding: 2px 8px; font-size: 9px; font-weight: bold; border-radius: 3px; margin-top: 4px; }
  .status-CONFIRMED { background: #d4edda; color: #155724; }
  .status-DRAFT { background: #fff3cd; color: #856404; }
  .status-JOURNALED { background: #cce5ff; color: #004085; }
  .status-VOID { background: #f8d7da; color: #721c24; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #999; }
  .meta-cell { padding: 6px 16px; border-bottom: 1px solid #ddd; }
  .meta-cell .label { font-size: 9px; color: #666; text-transform: uppercase; }
  .meta-cell .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #333; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
  .right { text-align: right; }
  .center { text-align: center; }
  .mono { font-family: monospace; font-size: 10px; }
  .small { font-size: 9px; }
  .bold { font-weight: 700; }
  .fee-row { color: #888; font-style: italic; }
  .total-row td { border-top: 2px solid #333; font-weight: 700; background: #f9f9f9; }
  .footer { display: grid; grid-template-columns: 1fr 1fr 1fr; border-top: 2px solid #333; }
  .sign-box { padding: 12px 16px; text-align: center; min-height: 80px; }
  .sign-box .role { font-size: 9px; color: #666; text-transform: uppercase; }
  .sign-box .name { margin-top: 40px; font-weight: 600; border-top: 1px solid #333; display: inline-block; padding-top: 4px; min-width: 120px; }
  .print-info { text-align: center; font-size: 8px; color: #999; padding: 6px; border-top: 1px solid #ddd; }
  @media print {
    body { padding: 0; }
    .voucher { border: 1px solid #000; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="voucher">
  <div class="header">
    <div class="header-left">
      <h1>${data.company_name}</h1>
      <div class="sub">${data.company_npwp ? 'NPWP: ' + data.company_npwp : ''}</div>
    </div>
    <div class="header-right">
      <div style="font-size:12px;font-weight:600;">VOUCHER ${data.voucher_type_label.toUpperCase()}</div>
      <div class="vnum">${data.voucher_number}</div>
      <span class="status status-${data.status}">${data.status}</span>
    </div>
  </div>

  <div class="meta">
    <div class="meta-cell"><div class="label">Tanggal Bank</div><div class="value">${fmtDate(data.bank_date)}</div></div>
    <div class="meta-cell"><div class="label">Periode</div><div class="value">${data.period_label}</div></div>
    <div class="meta-cell"><div class="label">Bank Account</div><div class="value">${data.bank_account_name} ${data.bank_account_number ? '(' + data.bank_account_number + ')' : ''}</div></div>
    <div class="meta-cell"><div class="label">Cabang</div><div class="value">${data.branch_name || '-'}</div></div>
    ${data.description ? `<div class="meta-cell" style="grid-column:span 2"><div class="label">Keterangan</div><div class="value">${data.description}</div></div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Uraian</th>
        <th>Payment Method</th>
        <th class="right">Gross</th>
        <th class="right">Tax</th>
        <th class="right">Fee</th>
        <th class="right">Nett</th>
        <th>COA</th>
        <th>Ref</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      <tr class="total-row">
        <td colspan="3" class="right">TOTAL</td>
        <td class="right">${fmt(data.total_gross)}</td>
        <td class="right">${fmt(data.total_tax)}</td>
        <td class="right">${fmt(data.total_fee)}</td>
        <td class="right">${fmt(data.total_nett)}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="sign-box">
      <div class="role">Dibuat oleh</div>
      <div class="name">${data.created_by_name || '___________'}</div>
    </div>
    <div class="sign-box">
      <div class="role">Disetujui oleh</div>
      <div class="name">${data.confirmed_by_name || '___________'}</div>
    </div>
    <div class="sign-box">
      <div class="role">Mengetahui</div>
      <div class="name">___________</div>
    </div>
  </div>

  <div class="print-info">
    Dicetak: ${new Date().toLocaleString('id-ID')} | ${data.is_manual ? 'MANUAL ENTRY' : 'SYSTEM GENERATED'}
  </div>
</div>
</body>
</html>`;
  }

  // ============================================
  // DROPDOWN: bank account options
  // ============================================

  async getBankAccounts(company_id: string): Promise<BankAccountOption[]> {
    if (!company_id) {
      throw new BankVoucherMissingCompanyError();
    }

    return bankVouchersRepository.getBankAccountsByCompany(company_id);
  }

  // ============================================
  // PRIVATE: build VoucherDay[] dari raw rows
  // ============================================

  private buildVoucherDays(
    rows: AggregatedVoucherRow[],
    periodMonth: number,
    periodYear: number,
    confirmedList: Array<{ transaction_date: Date; bank_account_id: number; status: string; voucher_number: string }> = []
  ): VoucherDay[] {
    // Group rows by: transaction_date + bank_account_id
    // This matches the DB unique constraint: (company_id, bank_date, bank_account_id, voucher_type, branch_id)
    const byDateAndBank = new Map<string, AggregatedVoucherRow[]>();
    for (const row of rows) {
      const dateKey = this.formatDate(row.transaction_date);
      const groupKey = `${dateKey}_${row.bank_account_id}`;
      if (!byDateAndBank.has(groupKey)) byDateAndBank.set(groupKey, []);
      byDateAndBank.get(groupKey)!.push(row);
    }

    // Sort group keys
    const sortedKeys = Array.from(byDateAndBank.keys()).sort();

    // Mapping existing confirmed vouchers for quick lookup
    const confirmedMap = new Map<string, { voucher_number: string; status: string }>();
    confirmedList.forEach(c => {
      const dateKey = this.formatDate(c.transaction_date);
      confirmedMap.set(`${dateKey}_${c.bank_account_id}`, {
        voucher_number: c.voucher_number,
        status: c.status
      });
    });

    // Voucher sequence counter for temporary numbering
    let tempSequence = 0;

    const vouchers: VoucherDay[] = [];

    for (const groupKey of sortedKeys) {
      const dayRows = byDateAndBank.get(groupKey)!;
      const firstRow = dayRows[0];
      const dateKey = this.formatDate(firstRow.transaction_date);
      
      const confirmedInfo = confirmedMap.get(groupKey);
      
      let voucherNumber: string;
      let isConfirmed = false;
      let status: VoucherDay['status'] = 'DRAFT';

      if (confirmedInfo) {
        voucherNumber = confirmedInfo.voucher_number;
        isConfirmed = true;
        status = confirmedInfo.status as any;
      } else {
        // Use temporary numbering for preview if not confirmed yet
        tempSequence++;
        voucherNumber = generateVoucherNumber(
          "BM",
          periodMonth,
          periodYear,
          tempSequence
        );
      }

      const lines = this.buildVoucherLines(dayRows);
      const dayTotal = lines.reduce((acc, l) => acc + l.nett_amount, 0);

      vouchers.push({
        transaction_date: dateKey,
        voucher_number: voucherNumber,
        voucher_type: "BM",
        bank_account_id: firstRow.bank_account_id,
        bank_account_name: firstRow.bank_account_name,
        branch_id: firstRow.branch_id,
        branch_name: firstRow.branch_name,
        lines,
        day_total: dayTotal,
        is_confirmed: isConfirmed,
        status: status
      });
    }

    return vouchers;
  }

  // ============================================
  // PRIVATE: build lines per hari
  // Per baris = 1 payment method + 1 fee line (jika ada fee)
  // ============================================

  private buildVoucherLines(rows: AggregatedVoucherRow[]): VoucherLine[] {
    const lines: VoucherLine[] = [];
    let lineNumber = 0;

    for (const row of rows) {
      const gross = parseFloat(row.gross_amount) || 0;
      const tax = parseFloat(row.tax_amount) || 0;
      const actualNett = parseFloat(row.actual_nett_amount) || 0;
      const fee = parseFloat(row.total_fee_amount) || 0;
      const txCount = parseInt(row.transaction_count) || 0;

      // Description = nama payment method
      const pmName = row.payment_method_name.toUpperCase();
      const feeDescription = `BIAYA ADMIN ${pmName}`;

      // Baris 1: Penjualan per payment method
      lineNumber++;
      lines.push({
        line_number: lineNumber,
        aggregate_id: (row as any).aggregate_id || (row as any).id, // Link ke source (aggregate_id di DDL)
        bank_account_id: row.bank_account_id,
        bank_account_name: row.bank_account_name,
        bank_account_number: row.bank_account_number,
        payment_method_id: row.payment_method_id,
        payment_method_name: row.payment_method_name,
        description: pmName,
        is_fee_line: false,
        gross_amount: gross,
        tax_amount: tax,
        nett_amount: actualNett, // FIX 1: pakai actual_nett_amount, bukan gross+tax
        actual_fee_amount: fee,
        coa_account_id: row.coa_account_id,
        fee_coa_account_id: row.fee_coa_account_id,
        transaction_count: txCount,
      });

      // Baris 2: Biaya Admin / Bonus (FIX 2: tampilkan juga fee negatif)
      if (fee !== 0) {
        lineNumber++;
        lines.push({
          line_number: lineNumber,
          aggregate_id: (row as any).aggregate_id || (row as any).id,
          bank_account_id: row.bank_account_id,
          bank_account_name: row.bank_account_name,
          bank_account_number: row.bank_account_number,
          payment_method_id: row.payment_method_id,
          payment_method_name: row.payment_method_name,
          description: fee < 0 ? `LEBIH ${pmName}` : feeDescription,
          is_fee_line: true,
          gross_amount: 0,
          tax_amount: 0,
          nett_amount: -fee, // fee negatif → nett positif (tambahan masuk)
          actual_fee_amount: fee,
          coa_account_id: row.coa_account_id,
          fee_coa_account_id: row.fee_coa_account_id,
          transaction_count: txCount,
        });
      }
    }

    return lines;
  }

  // ============================================
  // PRIVATE: build summary totals
  // ============================================

  private buildSummary(vouchers: VoucherDay[]) {
    let total_gross = 0;
    let total_tax = 0;
    let total_fee = 0;
    let total_nett = 0;
    let total_lines = 0;

    for (const v of vouchers) {
      for (const l of v.lines) {
        if (!l.is_fee_line) {
          total_gross += l.gross_amount;
          total_tax += l.tax_amount;
          total_nett += l.nett_amount;
        } else {
          total_fee += l.actual_fee_amount;
        }
        total_lines++;
      }
    }

    return {
      total_gross,
      total_tax,
      total_fee,
      total_nett: total_nett - total_fee,
      total_vouchers: vouchers.length,
      total_lines,
    };
  }

  // ============================================
  // PRIVATE: format Date utility
  // ============================================

  private formatDate(date: Date | string): string {
    if (typeof date === "string") return date.slice(0, 10);
    return date.toISOString().slice(0, 10);
  }
}

export const bankVouchersService = new BankVouchersService();
