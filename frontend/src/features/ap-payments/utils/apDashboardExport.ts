import * as XLSX from 'xlsx'
import type { ApDashboardResponse, ApPivotLocationGrouping } from '../api/apPayments.api'

export function exportApDashboardExcel(
  data: ApDashboardResponse,
  locationGrouping: ApPivotLocationGrouping,
) {
  const locationHeader = locationGrouping === 'branch' ? 'Cabang' : 'Rek (PT/CV)'
  const rows: Record<string, string | number>[] = []

  for (const group of data.due_date_pivot) {
    for (const row of group.rows) {
      rows.push({
        'Tanggal Jatuh Tempo': group.due_date_label,
        Supplier: row.supplier_name,
        'Kode Supplier': row.supplier_code ?? '',
        [locationHeader]:
          locationGrouping === 'branch'
            ? `${row.branch_name} (${row.branch_code})`
            : `${row.company_name}${row.company_type ? ` (${row.company_type})` : ''}`,
        Cabang: row.branch_name,
        'Kode Cabang': row.branch_code,
        'Nama Rek': row.company_name,
        'Tipe Rek': row.company_type ?? '',
        'Status PI': row.invoice_status,
        'Bisa Dibayar': row.can_pay ? 'Ya' : 'Tidak',
        Outstanding: row.outstanding,
        'Jumlah Invoice': row.invoice_count,
        Overdue: row.is_overdue ? 'Ya' : 'Tidak',
        'Nama Rekening': row.supplier_account_holder ?? '',
        Bank: row.supplier_bank_name ?? '',
        'No. Rekening': row.supplier_account_number ?? '',
        'No. AP': row.ap_payment_number ?? '',
        'Bayar Dari': [row.pay_from_account_holder, row.pay_from_bank_name, row.pay_from_account_number]
          .filter(Boolean)
          .join(' · '),
      })
    }

    rows.push({
      'Tanggal Jatuh Tempo': `Subtotal — ${group.due_date_label}`,
      Supplier: '',
      'Kode Supplier': '',
      [locationHeader]: '',
      Cabang: '',
      'Kode Cabang': '',
      'Nama Rek': '',
      'Tipe Rek': '',
      'Status PI': '',
      'Bisa Dibayar': '',
      Outstanding: group.total_outstanding,
      'Jumlah Invoice': group.total_invoice_count,
      Overdue: '',
      'Nama Rekening': '',
      Bank: '',
      'No. Rekening': '',
    })
  }

  rows.push({
    'Tanggal Jatuh Tempo': 'GRAND TOTAL',
    Supplier: '',
    'Kode Supplier': '',
    [locationHeader]: '',
    Cabang: '',
    'Kode Cabang': '',
    'Nama Rek': '',
    'Tipe Rek': '',
    'Status PI': '',
    'Bisa Dibayar': '',
    Outstanding: data.summary.total_outstanding,
    'Jumlah Invoice':
      data.summary.pending_post_count + data.summary.ready_to_pay_count,
    Overdue: '',
    'Nama Rekening': '',
    Bank: '',
    'No. Rekening': '',
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'AP Payment Planning')
  XLSX.writeFile(wb, `ap-planning-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
