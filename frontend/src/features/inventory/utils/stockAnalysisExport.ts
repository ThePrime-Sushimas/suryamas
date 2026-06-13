import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import type { StockAnalysisParams, StockAnalysisRow } from '../api/stockAnalysis.api'

export const STOCK_ANALYSIS_EXPORT_LIMIT = 10000

// Use explicit locale fallback to avoid issues on environments without id-ID support
const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']
const fmtDate = (d: string): string => {
  const [year, month, day] = d.split('-').map(Number)
  return `${String(day).padStart(2, '0')}-${MONTHS_ID[month - 1]}-${year}`
}

type WType = 'MAIN' | 'READY' | 'FINISHED_GOODS'
const VALID_WAREHOUSE_TYPES: WType[] = ['MAIN', 'READY', 'FINISHED_GOODS']

function getVisibleColumns(wt: string) {
  const t: WType = (VALID_WAREHOUSE_TYPES as string[]).includes(wt) ? (wt as WType) : 'READY'
  return {
    opening:             t === 'MAIN',
    masuk_pembelian:     t === 'MAIN',
    masuk_transfer:      t === 'READY' || t === 'FINISHED_GOODS',
    masuk_daily:         t === 'READY',
    masuk_produksi:      t === 'READY' || t === 'FINISHED_GOODS',
    penjualan_teoritis:  t === 'READY',
    waste:               t === 'READY',
    keluar_proses:       t === 'READY' || t === 'FINISHED_GOODS',
    keluar_transfer:     t === 'MAIN' || t === 'FINISHED_GOODS',
    keluar_daily:        t === 'MAIN',
    keluar_produksi:     t === 'READY',
    actual:              t === 'READY',
    selisih:             t === 'READY',
    selisih_rp:          t === 'READY',
    akurasi:             t === 'READY',
  }
}

export async function exportStockAnalysisExcel(
  params: StockAnalysisParams,
  warehouseName: string,
): Promise<void> {
  const queryParams: Record<string, unknown> = {
    branch_id: params.branch_id,
    date_from: params.date_from,
    date_to: params.date_to,
    page: 1,
    limit: STOCK_ANALYSIS_EXPORT_LIMIT,
  }
  if (params.warehouse_type) queryParams.warehouse_type = params.warehouse_type
  if (params.product_ids?.length) queryParams.product_ids = params.product_ids.join(',')
  if (params.category_id) queryParams.category_id = params.category_id
  if (params.search) queryParams.search = params.search
  if (params.only_with_variance) queryParams.only_with_variance = true

  const { data } = await api.get('/stock/analysis', { params: queryParams })
  const rows: StockAnalysisRow[] = data.data?.rows ?? []

  if (rows.length === 0) throw new Error('NO_DATA')

  const wt = params.warehouse_type ?? 'READY'
  const v = getVisibleColumns(wt)

  const sheetRows = rows.map(r => {
    const row: Record<string, unknown> = {
      'Tanggal': fmtDate(r.tanggal),
      'Produk': r.product_name,
      'Kode': r.product_code,
      'Kategori': r.category_name ?? '',
      'Satuan': r.uom,
      'Stok Awal': r.stok_awal ?? '',
    }
    if (v.opening)            row['Opening']                   = r.masuk_opening ?? ''
    if (v.masuk_pembelian)    row['Masuk Beli']                = r.masuk_pembelian ?? ''
    if (v.masuk_transfer)     row['Masuk Transfer']            = r.masuk_transfer ?? ''
    if (v.masuk_daily)        row['Pengambilan Harian Masuk']  = r.masuk_daily ?? ''
    if (v.masuk_produksi)     row['Masuk Produksi']            = r.masuk_produksi ?? ''
    if (v.penjualan_teoritis) row['Penj. Teoritis']            = r.penjualan_teoritis ?? ''
    if (v.waste)              row['Waste']                     = r.waste ?? ''
    if (v.keluar_proses)      row['Proses']                    = r.keluar_proses ?? ''
    if (v.keluar_transfer)    row['Keluar Transfer']           = r.keluar_transfer ?? ''
    if (v.keluar_daily)       row['Pengambilan Harian Keluar'] = r.keluar_daily ?? ''
    if (v.keluar_produksi)    row['Keluar Produksi']           = r.keluar_produksi ?? ''
    row['Expected'] = r.expected_sisa ?? ''
    if (v.actual)     row['Actual']       = r.actual_sisa ?? ''
    if (v.selisih)    row['Selisih']      = r.selisih_qty ?? ''
    if (v.selisih_rp) row['Selisih (Rp)'] = r.selisih_rp ?? ''
    if (v.akurasi)    row['Akurasi (%)']  = r.akurasi_pct != null ? Number(r.akurasi_pct.toFixed(1)) : ''
    return row
  })

  const ws = XLSX.utils.json_to_sheet(sheetRows)

  const keys = Object.keys(sheetRows[0])
  ws['!cols'] = keys.map(k => ({
    wch: Math.min(
      Math.max(k.length, ...sheetRows.map(r => String(r[k] ?? '').length)) + 2,
      40,
    ),
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Analysis')

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeName = warehouseName.replace(/[^a-zA-Z0-9-_]/g, '_')
  XLSX.writeFile(wb, `stock-analysis-${safeName}-${dateStr}.xlsx`)
}
