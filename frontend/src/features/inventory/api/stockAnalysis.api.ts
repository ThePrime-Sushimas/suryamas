import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

// ─── TYPES ──────────────────────────────────────────────────────────────────

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
  masuk_transfer: number
  masuk_produksi: number
  penjualan_teoritis: number
  waste: number
  expected_sisa: number | null
  actual_sisa: number | null
  selisih_qty: number | null
  selisih_rp: number | null
  cost_per_unit: number
  akurasi_pct: number | null

  has_opname: boolean
}

export interface StockAnalysisSummary {
  total_variance_cost_negative: number
  total_variance_cost_positive: number
  total_products: number
  products_with_negative_variance: number
  products_with_positive_variance: number
  avg_accuracy_pct: number | null
  worst_by_cost: { branch_name: string; product_name: string; total_rp: number } | null
  worst_by_accuracy: { branch_name: string; product_name: string; avg_pct: number } | null
}

export interface StockAnalysisParams {
  branch_id: string
  date_from: string
  date_to: string
  warehouse_type?: 'READY' | 'MAIN' | 'FINISHED_GOODS'
  product_id?: string
  category_id?: string
  only_with_variance?: boolean
  page?: number
  limit?: number
}

interface StockAnalysisResponse {
  rows: StockAnalysisRow[]
  summary: StockAnalysisSummary
  warehouse_name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ─── QUERY KEY ──────────────────────────────────────────────────────────────

const KEYS = {
  analysis: (params: StockAnalysisParams) => ['stock', 'analysis', params] as const,
}

// ─── HOOK ───────────────────────────────────────────────────────────────────

export const useStockAnalysis = (params: StockAnalysisParams) =>
  useQuery({
    queryKey: KEYS.analysis(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        branch_id: params.branch_id,
        date_from: params.date_from,
        date_to: params.date_to,
        page: params.page ?? 1,
        limit: params.limit ?? 50,
      }
      if (params.warehouse_type) queryParams.warehouse_type = params.warehouse_type
      if (params.product_id) queryParams.product_id = params.product_id
      if (params.category_id) queryParams.category_id = params.category_id
      if (params.only_with_variance) queryParams.only_with_variance = true

      const { data } = await api.get('/stock/analysis', { params: queryParams })
      return {
        data: data.data as StockAnalysisResponse,
        pagination: data.pagination as Pagination,
      }
    },
    enabled: !!params.branch_id && !!params.date_from && !!params.date_to,
    staleTime: 5 * 60_000, // 5 minutes — historical data doesn't change often
  })
