import * as XLSX from 'xlsx'
import type { ShortageByEmployeeGroup } from '../api/shortageReport.api'

export function exportShortageDeductionExcel(
  groups: ShortageByEmployeeGroup[],
  startDate: string,
  endDate: string,
) {
  const summaryRows = groups.map((g) => ({
    Karyawan: g.employee_name,
    Cabang: g.branch_name ?? '-',
    'Jumlah Kejadian': g.shortage_count,
    'Total Potongan': g.total_deduction_amount,
    'Sudah Dibayar': g.paid_count,
    'Belum Dibayar': g.shortage_count - g.paid_count,
  }))

  const detailRows = groups.flatMap((g) =>
    g.detail.map((d) => ({
      Karyawan: g.employee_name,
      Tanggal: d.date,
      Produk: d.item_name ?? '-',
      Qty: d.qty,
      'Nilai Shortage': d.total_cost,
      'Jumlah Potongan': d.deduction_amount,
      Catatan: d.notes ?? '-',
      Status: d.resolve_status,
      Estimasi: d.is_provisional ? 'Ya' : 'Tidak',
      'Status Bayar': d.deduction_paid_at ? 'Sudah' : 'Belum',
    })),
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Detail')
  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `shortage-potongan-${startDate}_${endDate}-${dateStr}.xlsx`)
}
