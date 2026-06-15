import type { WasteSource } from '../api/wasteReport.api'

export const fmt = (n: number | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

export const fmtRp = (n: number | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(n)

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export const SOURCE_LABELS: Record<WasteSource, string> = {
  GOODS_PROCESSING: 'Barang Diproses',
  STOCK_ADJUSTMENT: 'Waste & Breakdown',
  PRODUCTION_ORDER: 'Produksi Harian',
  DAILY_OPNAME: 'Opname Harian',
}

export const SOURCE_COLORS: Record<WasteSource, string> = {
  GOODS_PROCESSING: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  STOCK_ADJUSTMENT: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  PRODUCTION_ORDER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DAILY_OPNAME: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
}

export const SOURCE_CHART_COLORS: Record<WasteSource, string> = {
  GOODS_PROCESSING: '#7c3aed',
  STOCK_ADJUSTMENT: '#e11d48',
  PRODUCTION_ORDER: '#d97706',
  DAILY_OPNAME: '#0284c7',
}

export const DETAIL_PAGE_SIZE = 50
