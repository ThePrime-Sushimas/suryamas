import { bankVouchersRepository } from './bank-vouchers.repository'
import {
  generateVoucherNumber,
  getPeriodLabel,
  getPeriodDateRange,
  validatePeriod,
} from './bank-vouchers.config'
import {
  BankVoucherNoPeriodDataError,
  BankVoucherMissingCompanyError,
  BankVoucherInvalidPeriodError,
  BankVoucherInvalidBankAccountError,
} from './bank-vouchers.errors'
import type {
  BankVoucherPreviewParams,
  BankVoucherPreviewResult,
  BankVoucherSummaryParams,
  BankVoucherSummaryResult,
  VoucherDay,
  VoucherLine,
  AggregatedVoucherRow,
  BankAccountOption,
} from './bank-vouchers.types'
import { logInfo, logError } from '../../config/logger'

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

  async getPreview(params: BankVoucherPreviewParams): Promise<BankVoucherPreviewResult> {
    try {
      if (!params.company_id) {
        throw new BankVoucherMissingCompanyError()
      }

      // Validate period
      validatePeriod(params.period_month, params.period_year)

      const { start, end } = getPeriodDateRange(params.period_month, params.period_year)
      const periodLabel = getPeriodLabel(params.period_month, params.period_year)

      logInfo('Bank voucher preview started', {
        company_id: params.company_id,
        period: `${params.period_month}/${params.period_year}`,
        branch_id: params.branch_id,
      })

      const rows = await bankVouchersRepository.getReconciledAggregates({
        company_id: params.company_id,
        branch_id: params.branch_id,
        date_start: start,
        date_end: end,
        bank_account_id: params.bank_account_id,
      })

      if (rows.length === 0) {
        throw new BankVoucherNoPeriodDataError(periodLabel)
      }

      // Build voucher days (on-the-fly numbering)
      const vouchers = this.buildVoucherDays(rows, params.period_month, params.period_year)

      // Build summary
      const summary = this.buildSummary(vouchers)

      logInfo('Bank voucher preview completed', {
        company_id: params.company_id,
        total_vouchers: vouchers.length,
        total_nett: summary.total_nett,
      })

      return {
        period_month: params.period_month,
        period_year: params.period_year,
        period_label: periodLabel,
        company_id: params.company_id,
        branch_id: params.branch_id,
        vouchers,
        summary,
      }
    } catch (error) {
      logError('Bank voucher preview failed', error)
      throw error
    }
  }

  // ============================================
  // SUMMARY: totals + running balance per day
  // ============================================

  async getSummary(params: BankVoucherSummaryParams): Promise<BankVoucherSummaryResult> {
    try {
      if (!params.company_id) {
        throw new BankVoucherMissingCompanyError()
      }

      validatePeriod(params.period_month, params.period_year)

      const { start, end } = getPeriodDateRange(params.period_month, params.period_year)
      const periodLabel = getPeriodLabel(params.period_month, params.period_year)

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
      ])

      // By bank summary
      const by_bank = byBankRows.map((row) => {
        const totalMasuk = parseFloat(row.total_nett) || 0
        const totalKeluar = 0 // Phase 2: BK akan diimplementasi
        return {
          bank_account_id: row.bank_account_id,
          bank_account_name: row.bank_account_name,
          total_masuk: totalMasuk,
          total_keluar: totalKeluar,
          saldo: totalMasuk - totalKeluar,
        }
      })

      // By date with running balance
      let runningBalance = 0
      const by_date = byDayRows.map((row) => {
        const totalMasuk = parseFloat(row.total_nett) || 0
        const totalKeluar = 0 // Phase 2: BK
        runningBalance += totalMasuk - totalKeluar
        return {
          transaction_date: this.formatDate(row.transaction_date),
          total_masuk: totalMasuk,
          total_keluar: totalKeluar,
          saldo_harian: totalMasuk - totalKeluar,
          running_balance: runningBalance,
        }
      })

      const totalBankMasuk = by_bank.reduce((acc, b) => acc + b.total_masuk, 0)
      const totalBankKeluar = 0 // Phase 2

      return {
        period_label: periodLabel,
        total_bank_masuk: totalBankMasuk,
        total_bank_keluar: totalBankKeluar,
        saldo_berjalan: totalBankMasuk - totalBankKeluar,
        by_bank,
        by_date,
      }
    } catch (error) {
      logError('Bank voucher summary failed', error)
      throw error
    }
  }

  // ============================================
  // DROPDOWN: bank account options
  // ============================================

  async getBankAccounts(company_id: string): Promise<BankAccountOption[]> {
    if (!company_id) {
      throw new BankVoucherMissingCompanyError()
    }

    return bankVouchersRepository.getBankAccountsByCompany(company_id)
  }

  // ============================================
  // PRIVATE: build VoucherDay[] dari raw rows
  // ============================================

  private buildVoucherDays(
    rows: AggregatedVoucherRow[],
    periodMonth: number,
    periodYear: number
  ): VoucherDay[] {
    // Group rows by transaction_date
    const byDate = new Map<string, AggregatedVoucherRow[]>()
    for (const row of rows) {
      const dateKey = this.formatDate(row.transaction_date)
      if (!byDate.has(dateKey)) byDate.set(dateKey, [])
      byDate.get(dateKey)!.push(row)
    }

    // Sort dates ascending
    const sortedDates = Array.from(byDate.keys()).sort()

    // Voucher sequence counter — starts at 1 per period
    // NOTE: In phase 2 (confirm), sequence comes from DB
    let bmSequence = 0

    const vouchers: VoucherDay[] = []

    for (const dateKey of sortedDates) {
      const dayRows = byDate.get(dateKey)!

      // 1 voucher BM per hari (semua bank masuk dalam 1 voucher)
      bmSequence++
      const voucherNumber = generateVoucherNumber('BM', periodMonth, periodYear, bmSequence)

      const lines = this.buildVoucherLines(dayRows)

      const dayTotal = lines.reduce((acc, l) => acc + l.nett_amount, 0)

      // Branch dari baris pertama
      const firstRow = dayRows[0]

      vouchers.push({
        transaction_date: dateKey,
        voucher_number: voucherNumber,
        voucher_type: 'BM',
        branch_id: firstRow.branch_id,
        branch_name: firstRow.branch_name,
        lines,
        day_total: dayTotal,
      })
    }

    return vouchers
  }

  // ============================================
  // PRIVATE: build lines per hari
  // Per baris = 1 payment method + 1 fee line (jika ada fee)
  // ============================================

  private buildVoucherLines(rows: AggregatedVoucherRow[]): VoucherLine[] {
    const lines: VoucherLine[] = []
    let lineNumber = 0

    for (const row of rows) {
      const gross = parseFloat(row.gross_amount) || 0
      const tax = parseFloat(row.tax_amount) || 0
      const actualNett = parseFloat(row.actual_nett_amount) || 0
      const fee = parseFloat(row.total_fee_amount) || 0
      const txCount = parseInt(row.transaction_count) || 0

      // Description = nama payment method
      const pmName = row.payment_method_name.toUpperCase()
      const feeDescription = `BIAYA ADMIN ${pmName}`

      // Baris 1: Penjualan per payment method
      lineNumber++
      lines.push({
        line_number: lineNumber,
        bank_account_id: row.bank_account_id,
        bank_account_name: row.bank_account_name,
        bank_account_number: row.bank_account_number,
        payment_method_id: row.payment_method_id,
        payment_method_name: row.payment_method_name,
        description: pmName,
        is_fee_line: false,
        gross_amount: gross,
        tax_amount: tax,
        nett_amount: actualNett,
        actual_fee_amount: fee,
        transaction_count: txCount,
      })

      // Baris 2: Biaya Admin (hanya jika ada fee > 0)
      if (fee > 0) {
        lineNumber++
        lines.push({
          line_number: lineNumber,
          bank_account_id: row.bank_account_id,
          bank_account_name: row.bank_account_name,
          bank_account_number: row.bank_account_number,
          payment_method_id: row.payment_method_id,
          payment_method_name: row.payment_method_name,
          description: feeDescription,
          is_fee_line: true,
          gross_amount: 0,
          tax_amount: 0,
          nett_amount: -fee,
          actual_fee_amount: fee,
          transaction_count: txCount,
        })
      }
    }

    return lines
  }

  // ============================================
  // PRIVATE: build summary totals
  // ============================================

  private buildSummary(vouchers: VoucherDay[]) {
    let total_gross = 0
    let total_tax = 0
    let total_fee = 0
    let total_nett = 0
    let total_lines = 0

    for (const v of vouchers) {
      for (const l of v.lines) {
        if (!l.is_fee_line) {
          total_gross += l.gross_amount
          total_tax += l.tax_amount
          total_nett += l.nett_amount
        } else {
          total_fee += l.actual_fee_amount
        }
        total_lines++
      }
    }

    return {
      total_gross,
      total_tax,
      total_fee,
      total_nett: total_nett - total_fee,
      total_vouchers: vouchers.length,
      total_lines,
    }
  }

  // ============================================
  // PRIVATE: format Date utility
  // ============================================

  private formatDate(date: Date | string): string {
    if (typeof date === 'string') return date.slice(0, 10)
    return date.toISOString().slice(0, 10)
  }
}

export const bankVouchersService = new BankVouchersService()
