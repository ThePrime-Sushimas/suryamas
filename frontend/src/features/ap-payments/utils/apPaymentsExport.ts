import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import type { ApPaymentListQuery } from '../types/apPaymentFilters.types'
import type { ApPayment } from '../api/apPayments.api'
import { AP_PAYMENT_METHOD_LABELS, AP_STATUS_CONFIG } from '../constants'

const fmtDate = (d: string | null): string =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

/**
 * Fetch all AP payments matching the current filters (no pagination limit)
 * and generate an .xlsx file for download.
 */
export async function exportApPaymentsExcel(
  apiQuery: ApPaymentListQuery,
): Promise<void> {
  // Fetch all matching payments (override pagination with high limit)
  const params: ApPaymentListQuery = {
    ...apiQuery,
    page: 1,
    limit: 10000,
  }

  const { data: response } = await api.get('/ap-payments', { params })
  const payments: ApPayment[] = response.data ?? []

  if (payments.length === 0) {
    throw new Error('NO_DATA')
  }

  // Build rows for the worksheet
  const rows = payments.map((p) => ({
    'No. Pembayaran': p.payment_number,
    Supplier: p.supplier_name,
    Cabang: p.branch_name,
    Metode: AP_PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method,
    'Bank Account': p.bank_account_name,
    Total: Number(p.total_amount),
    Status: AP_STATUS_CONFIG[p.status]?.label ?? p.status,
    'Tanggal Bayar': fmtDate(p.payment_date ?? p.created_at),
  }))

  // Generate workbook
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'AP Payments')

  // Download file with date-stamped filename
  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `ap-payments-${dateStr}.xlsx`)
}
