// ─── STOCK ANALYSIS CENTER TYPES ──────────────────────────────────────────────

export interface StockAnalysisFilter {
  branch_id: string          // wajib
  date_from: string          // YYYY-MM-DD, wajib
  date_to: string            // YYYY-MM-DD, wajib, max 31 hari
  warehouse_type?: 'READY' | 'MAIN' | 'FINISHED_GOODS'  // default: 'READY'
  product_ids?: string[]     // filter specific products (array of UUIDs)
  category_id?: string
  search?: string            // server-side product name/code search
  only_with_variance?: boolean  // hanya tampilkan yang selisih ≠ 0
  page?: number
  limit?: number
}

export interface StockAnalysisRow {
  tanggal: string
  branch_id: string
  branch_name: string
  product_id: string
  product_code: string
  product_name: string
  category_name: string | null
  uom: string
  uom_warning: string | null

  stok_awal: number | null
  masuk_opening: number
  masuk_transfer: number
  masuk_produksi: number
  penjualan_teoritis: number
  waste: number
  keluar_proses: number
  expected_sisa: number | null
  actual_sisa: number | null
  selisih_qty: number | null
  selisih_rp: number | null
  cost_per_unit: number
  akurasi_pct: number | null

  has_opname: boolean
}

export interface StockAnalysisSummary {
  total_variance_cost_negative: number   // total kerugian (selisih negatif × cost)
  total_variance_cost_positive: number   // total surplus (selisih positif × cost)
  total_products: number
  products_with_negative_variance: number
  products_with_positive_variance: number
  avg_accuracy_pct: number | null
  worst_by_cost: { branch_name: string; product_name: string; total_rp: number } | null
  worst_by_accuracy: { branch_name: string; product_name: string; avg_pct: number } | null
}

export interface StockAnalysisResponse {
  data: StockAnalysisRow[]
  summary: StockAnalysisSummary
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
