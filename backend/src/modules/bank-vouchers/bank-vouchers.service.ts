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
} from "./bank-vouchers.types";
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

      // By bank summary
      const by_bank = byBankRows.map((row) => {
        const totalMasuk = parseFloat(row.total_nett) || 0;
        const totalKeluar = 0; // Phase 2: BK akan diimplementasi
        return {
          bank_account_id: row.bank_account_id,
          bank_account_name: row.bank_account_name,
          total_masuk: totalMasuk,
          total_keluar: totalKeluar,
          saldo: totalMasuk - totalKeluar,
        };
      });

      // By date with running balance
      let runningBalance = 0;
      const by_date = byDayRows.map((row) => {
        const totalMasuk = parseFloat(row.total_nett) || 0;
        const totalKeluar = 0; // Phase 2: BK
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
      const totalBankKeluar = 0; // Phase 2

      return {
        period_label: periodLabel,
        total_bank_masuk: totalBankMasuk,
        total_bank_keluar: totalBankKeluar,
        saldo_berjalan: totalBankMasuk - totalBankKeluar,
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
          bank_date: v.transaction_date, // Phase 1: bank_date = transaction_date
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
            aggregate_id: l.aggregate_id, // ini penting
            source_type: "RECONCILIATION",
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
        confirmedNumbers.push(num);
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
