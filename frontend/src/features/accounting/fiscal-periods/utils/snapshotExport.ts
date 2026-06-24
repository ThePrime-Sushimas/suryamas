import * as XLSX from 'xlsx'
import type {
  ClosingSnapshotDetail,
  ClosingSnapshotTrialBalanceLine,
  ClosingSnapshotReportLine,
} from '../types/fiscal-period.types'

/**
 * Export closing snapshot to Excel (4 sheets: Summary, Trial Balance, Income Statement, Balance Sheet)
 */
export function exportSnapshotToExcel(snapshot: ClosingSnapshotDetail, periodLabel: string) {
  const wb = XLSX.utils.book_new()
  const { header, trial_balance, income_statement, balance_sheet } = snapshot

  // ─── Sheet 1: Summary ───────────────────────────────────────────────────────
  const summaryData = [
    ['Closing Snapshot — Laporan Keuangan'],
    [],
    ['Periode', periodLabel],
    ['Versi', `v${header.version}`],
    ['Tanggal Closing', new Date(header.closed_at).toLocaleString('id-ID')],
    ['Status', header.is_latest ? 'Latest (Versi Terkini)' : 'Outdated (Ada Versi Lebih Baru)'],
    [],
    ['Ringkasan'],
    ['Total Revenue', header.total_revenue],
    ['Total Expense', header.total_expense],
    ['Net Income', header.net_income],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // ─── Sheet 2: Trial Balance ─────────────────────────────────────────────────
  const tbHeaders = [
    'Account Code', 'Account Name', 'Account Type',
    'Opening Debit', 'Opening Credit',
    'Period Debit', 'Period Credit',
    'Closing Debit', 'Closing Credit',
    'POS Debit', 'POS Credit',
    'Bank Debit', 'Bank Credit',
    'Other Debit', 'Other Credit',
  ]
  const tbRows = trial_balance.map((r: ClosingSnapshotTrialBalanceLine) => [
    r.account_code, r.account_name, r.account_type,
    r.opening_debit, r.opening_credit,
    r.period_debit, r.period_credit,
    r.closing_debit, r.closing_credit,
    r.pos_debit, r.pos_credit,
    r.bank_debit, r.bank_credit,
    r.other_debit, r.other_credit,
  ])
  const wsTB = XLSX.utils.aoa_to_sheet([tbHeaders, ...tbRows])
  wsTB['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, ...Array(12).fill({ wch: 15 })]
  XLSX.utils.book_append_sheet(wb, wsTB, 'Trial Balance')

  // ─── Sheet 3: Income Statement ──────────────────────────────────────────────
  const isHeaders = ['Account Code', 'Account Name', 'Type', 'Group', 'Debit', 'Credit']
  const isRows = income_statement.map((r: ClosingSnapshotReportLine) => [
    r.account_code, r.account_name, r.account_type, r.group_label ?? '', r.debit_amount, r.credit_amount,
  ])
  const wsIS = XLSX.utils.aoa_to_sheet([isHeaders, ...isRows])
  wsIS['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsIS, 'Income Statement')

  // ─── Sheet 4: Balance Sheet ─────────────────────────────────────────────────
  const bsHeaders = ['Account Code', 'Account Name', 'Type', 'Group', 'Debit', 'Credit']
  const bsRows = balance_sheet.map((r: ClosingSnapshotReportLine) => [
    r.account_code, r.account_name, r.account_type, r.group_label ?? '', r.debit_amount, r.credit_amount,
  ])
  const wsBS = XLSX.utils.aoa_to_sheet([bsHeaders, ...bsRows])
  wsBS['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsBS, 'Balance Sheet')

  // ─── Download ───────────────────────────────────────────────────────────────
  const filename = `closing-snapshot_${periodLabel}_v${header.version}.xlsx`
  XLSX.writeFile(wb, filename)
}
