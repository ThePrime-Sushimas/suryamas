import * as XLSX from 'xlsx'
import type { WasteRecord, WasteSource } from '../api/wasteReport.api'

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']

const fmtDate = (d: string): string => {
  const iso = d.includes('T') ? d.slice(0, 10) : d
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return d
  return `${String(day).padStart(2, '0')}-${MONTHS_ID[month - 1]}-${year}`
}

const SOURCE_LABELS: Record<WasteSource, string> = {
  GOODS_PROCESSING: 'Barang Diproses',
  STOCK_ADJUSTMENT: 'Waste & Breakdown',
  PRODUCTION_ORDER: 'Produksi Harian',
  DAILY_OPNAME: 'Opname Harian',
}

function productionOrderNote(r: WasteRecord): string {
  if (r.source !== 'PRODUCTION_ORDER') return ''
  if (r.metadata?.is_voided === true) return 'PO dibatalkan'
  if (r.metadata?.is_provisional === true) return 'PO belum final'
  const status = r.metadata?.order_status
  return typeof status === 'string' ? status : ''
}

function autoColWidth(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return []
  const keys = Object.keys(rows[0])
  return keys.map((k) => ({
    wch: Math.min(Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2, 50),
  }))
}

export function exportWasteDetailExcel(
  records: WasteRecord[],
  options: {
    startDate: string
    endDate: string
    branchNameById?: Map<string, string>
  },
): void {
  if (records.length === 0) {
    throw new Error('NO_DATA')
  }

  const { startDate, endDate, branchNameById } = options
  const branchOf = (r: WasteRecord) => r.branch_name ?? branchNameById?.get(r.branch_id) ?? ''

  const rows = records.map((r) => ({
    Tanggal: fmtDate(r.date),
    Cabang: branchOf(r),
    Modul: SOURCE_LABELS[r.source],
    'Status PO': productionOrderNote(r),
    Produk: r.item_name ?? r.item_id,
    Qty: r.qty,
    'Unit Cost': r.unit_cost,
    'Total Cost': r.total_cost,
    Alasan: r.reason ?? '',
    Referensi: r.reference_code ?? r.reference_id,
    Catatan:
      r.metadata?.cost_unavailable === true ? 'Cost belum tersedia' : productionOrderNote(r) || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = autoColWidth(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Detail Transaksi')

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `waste-detail-${startDate}_${endDate}-${dateStr}.xlsx`)
}
