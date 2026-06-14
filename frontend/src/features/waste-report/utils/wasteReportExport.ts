import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import type {
  WasteReportParams,
  WasteReportResponse,
  WasteRecord,
  WasteSource,
} from '../api/wasteReport.api'
import { groupWasteByItem } from './groupWasteByItem'

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']

const fmtDate = (d: string): string => {
  const iso = d.includes('T') ? d.slice(0, 10) : d
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return d
  return `${String(day).padStart(2, '0')}-${MONTHS_ID[month - 1]}-${year}`
}

const SOURCE_LABELS: Record<WasteSource, string> = {
  GOODS_PROCESSING: 'Bongkar Barang',
  STOCK_ADJUSTMENT: 'Penyesuaian Stok',
  PRODUCTION_ORDER: 'Produksi',
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

function appendSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Tidak ada data' }])
  ws['!cols'] = autoColWidth(rows.length ? rows : [{ Info: 'Tidak ada data' }])
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
}

export async function exportWasteReportExcel(params: WasteReportParams): Promise<void> {
  const { data } = await api.get('/waste-report', { params })
  const report = data.data as WasteReportResponse
  const { summary, records, monthly_selisih: monthly } = report
  const byItem = groupWasteByItem(records)

  const wb = XLSX.utils.book_new()

  const summaryRows: Record<string, unknown>[] = [
    { Metrik: 'Total Qty Waste', Nilai: summary.total_waste_qty },
    { Metrik: 'Total Nilai Waste (Rp)', Nilai: summary.total_waste_cost },
    {
      Metrik: '% dari Pembelian',
      Nilai: summary.percentage_of_purchase != null ? `${summary.percentage_of_purchase}%` : '-',
    },
    { Metrik: 'Jumlah Transaksi', Nilai: records.length },
    { Metrik: '', Nilai: '' },
    { Metrik: 'Breakdown Sumber', Nilai: 'Qty', Extra: 'Nilai (Rp)' },
  ]

  for (const [source, label] of Object.entries(SOURCE_LABELS) as [WasteSource, string][]) {
    const b = summary.breakdown_by_source[source]
    summaryRows.push({
      Metrik: label,
      Nilai: b?.qty ?? 0,
      Extra: b?.cost ?? 0,
    })
  }

  appendSheet(wb, 'Ringkasan', summaryRows)

  appendSheet(
    wb,
    'Detail Transaksi',
    records.map((r) => ({
      Tanggal: fmtDate(r.date),
      Cabang: r.branch_name ?? '',
      Sumber: SOURCE_LABELS[r.source],
      'Status PO': productionOrderNote(r),
      Produk: r.item_name ?? r.item_id,
      Qty: r.qty,
      'Unit Cost': r.unit_cost,
      'Total Cost': r.total_cost,
      Alasan: r.reason ?? '',
      Referensi: r.reference_code ?? r.reference_id,
      Catatan:
        r.metadata?.cost_unavailable === true
          ? 'Cost belum tersedia'
          : productionOrderNote(r) || '',
    })),
  )

  appendSheet(
    wb,
    'Per Produk',
    byItem.map((g, i) => ({
      Rank: i + 1,
      Produk: g.item_name ?? g.item_id,
      'Total Qty': g.total_qty,
      'Total Cost': g.total_cost,
      Transaksi: g.record_count,
      'Bongkar Barang (Rp)': g.breakdown_by_source.GOODS_PROCESSING.cost,
      'Penyesuaian (Rp)': g.breakdown_by_source.STOCK_ADJUSTMENT.cost,
      'Produksi (Rp)': g.breakdown_by_source.PRODUCTION_ORDER.cost,
      'Opname Harian (Rp)': g.breakdown_by_source.DAILY_OPNAME.cost,
    })),
  )

  appendSheet(
    wb,
    'Kebocoran Bulanan',
    monthly.map((m) => ({
      Tanggal: fmtDate(m.date),
      Cabang: m.branch_name ?? '',
      Produk: m.item_name ?? m.item_id,
      'Selisih Qty': m.selisih_qty,
      'Selisih Nilai': Math.abs(m.selisih_value),
      'Catatan Investigasi': m.investigasi_note ?? '',
      Catatan: 'Indikasi kebocoran — belum terverifikasi sebagai waste',
    })),
  )

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `waste-report-${params.start_date}_${params.end_date}-${dateStr}.xlsx`)
}
