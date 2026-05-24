import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import type { CombinedInvoicePaymentQuery, CombinedInvoicePaymentRow } from '../api/apPayments.api'
import { AP_PAYMENT_METHOD_LABELS, AP_STATUS_CONFIG } from '../constants'

/** YYYY-MM-DD format for Excel sortability */
const fmtDate = (d: string | null): string =>
  d ? d.slice(0, 10) : ''

/**
 * Fetch all combined invoice+payment rows matching the current filters
 * and generate an .xlsx file for download.
 * Uses pagination loop to handle any data size.
 */
export async function exportCombinedExcel(
  query: Omit<CombinedInvoicePaymentQuery, 'page' | 'limit'>,
): Promise<void> {
  const PAGE_SIZE = 5000
  let page = 1
  let allRows: CombinedInvoicePaymentRow[] = []
  let total = 0

  // Fetch in pages until we have all data
  while (true) {
    const params = { ...query, page, limit: PAGE_SIZE }
    const { data: response } = await api.get('/ap-payments/combined', { params })
    const rows: CombinedInvoicePaymentRow[] = response.data ?? []
    total = response.pagination?.total ?? rows.length

    allRows = allRows.concat(rows)

    if (allRows.length >= total || rows.length < PAGE_SIZE) break
    page++
  }

  if (allRows.length === 0) {
    throw new Error('NO_DATA')
  }

  const excelRows = allRows.map((r) => ({
    'No. Invoice': r.invoice_number,
    'Tgl Invoice': fmtDate(r.invoice_date),
    'Tgl Terima': fmtDate(r.earliest_received_date),
    'Jatuh Tempo': fmtDate(r.invoice_due_date),
    Supplier: r.supplier_name,
    Cabang: r.branch_name,
    'Status Invoice': r.invoice_status === 'APPROVED' ? 'Approved' : 'Posted',
    'Total Invoice': r.invoice_total_amount,
    'Sisa Outstanding': r.invoice_remaining_amount,
    'Aging (hari)': r.aging_days ?? '',
    Overdue: r.is_overdue ? 'Ya' : 'Tidak',
    'No. Pembayaran': r.payment_number ?? '',
    'Status Pembayaran': r.payment_status
      ? (AP_STATUS_CONFIG[r.payment_status as keyof typeof AP_STATUS_CONFIG]?.label ?? r.payment_status)
      : '',
    'Metode Bayar': r.payment_method
      ? (AP_PAYMENT_METHOD_LABELS[r.payment_method as keyof typeof AP_PAYMENT_METHOD_LABELS] ?? r.payment_method)
      : '',
    'Tgl Bayar': fmtDate(r.paid_at ?? r.payment_date),
    'Nominal Bayar': r.payment_amount ?? '',
    'Bank Sumber': r.source_bank_name ?? '',
    'No. Rek Sumber': r.source_account_number ?? '',
    'Nama Rek Sumber': r.source_account_name ?? '',
    'Bank Tujuan': r.dest_bank_name ?? '',
    'No. Rek Tujuan': r.dest_account_number ?? '',
    'Nama Rek Tujuan': r.dest_account_name ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(excelRows)

  // Auto-width columns
  const colWidths = Object.keys(excelRows[0]).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...excelRows.map((r) => String((r as Record<string, unknown>)[key] ?? '').length),
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gabungan Invoice & Payment')

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `ap-gabungan-${dateStr}.xlsx`)
}
