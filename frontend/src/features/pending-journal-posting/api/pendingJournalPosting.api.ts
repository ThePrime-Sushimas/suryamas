import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'

// ─── Single Source of Truth: Module Config ───────────────────────────────────
// ⚠️ MENAMBAH MODULE BARU? Cukup tambah 1 entry di sini.
// Type, labels, paths, dan VALID_MODULES (di file filter) semua auto-derive.
// Baca juga: backend/src/modules/pending-journal-posting/ADDING_NEW_MODULE.md

export const PENDING_MODULE_CONFIG = {
  purchase_invoices: { label: 'Purchase Invoices', detailPath: '/inventory/purchase-invoices' },
  general_invoices: { label: 'General Invoices', detailPath: '/finance/general-invoices' },
  ap_payments: { label: 'AP Payments', detailPath: '/finance/ap-payments' },
  asset_disposals: { label: 'Asset Disposals', detailPath: '/fixed-assets/disposals' },
  stock_adjustments: { label: 'Stock Adjustments', detailPath: '/inventory/stock-adjustments' },
  stock_transfers: { label: 'Stock Transfers', detailPath: '/inventory/stock-transfers' },
  production_orders: { label: 'Production Orders', detailPath: '/food-production/production' },
  marketplace_po: { label: 'Marketplace PO', detailPath: '/inventory/marketplace-po' },
  bank_reconciliation: { label: 'Bank Reconciliation', detailPath: '/bank-reconciliation' },
  pos_aggregates: { label: 'POS Aggregates', detailPath: '/pos-aggregates' },
} as const

// ─── Derived Types & Constants ───────────────────────────────────────────────

export type PendingModule = keyof typeof PENDING_MODULE_CONFIG

export const PENDING_MODULE_KEYS = Object.keys(PENDING_MODULE_CONFIG) as PendingModule[]

export const MODULE_LABELS: Record<PendingModule, string> = Object.fromEntries(
  Object.entries(PENDING_MODULE_CONFIG).map(([k, v]) => [k, v.label])
) as Record<PendingModule, string>

export const MODULE_DETAIL_PATHS: Record<PendingModule, string> = Object.fromEntries(
  Object.entries(PENDING_MODULE_CONFIG).map(([k, v]) => [k, v.detailPath])
) as Record<PendingModule, string>

// ─── Response Types ──────────────────────────────────────────────────────────

export interface PendingPostingRecord {
  id: string
  module: PendingModule
  ref_number: string
  transaction_date: string
  amount: number
  status: string
  company_id: string
  company_name: string | null
  branch_id: string | null
  branch_name: string | null
  record_count?: number
}

export interface PendingPostingSummary {
  module: PendingModule
  count: number
  total_amount: number
}

export interface PendingPostingListResponse {
  records: PendingPostingRecord[]
  summary: PendingPostingSummary[]
}

export interface PostSingleResult {
  success: boolean
  module: PendingModule
  id: string
  error?: string
}

export interface PostBulkResult {
  results: PostSingleResult[]
  success_count: number
  failure_count: number
}

export interface PendingPostingListParams {
  date_from?: string
  date_to?: string
  module?: PendingModule | ''
  branch_id?: string
  page?: number
  limit?: number
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const KEYS = {
  list: (params: Record<string, unknown>) => ['pending-journal-posting', params] as const,
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export const usePendingJournalPostingList = (params: PendingPostingListParams) =>
  useQuery({
    queryKey: KEYS.list(params as Record<string, unknown>),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
      }
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.module) queryParams.module = params.module
      if (params.branch_id) queryParams.branch_id = params.branch_id

      const { data } = await api.get('/pending-journal-posting', { params: queryParams })
      return {
        data: data.data as PendingPostingListResponse,
        pagination: data.pagination as {
          page: number
          limit: number
          total: number
          totalPages: number
        },
      }
    },
    staleTime: 15_000,
  })

export const usePostSinglePendingJournal = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ module, id }: { module: PendingModule; id: string }) => {
      const { data } = await api.post(`/pending-journal-posting/${module}/${id}/post`)
      return data.data as PostSingleResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-journal-posting'] })
      toast.success('Journal berhasil di-post')
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal mem-post journal')),
  })
}

export const useBulkPostPendingJournal = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ module, ids }: { module: PendingModule; ids: string[] }) => {
      const { data } = await api.post('/pending-journal-posting/bulk-post', { module, ids })
      return data.data as PostBulkResult
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['pending-journal-posting'] })
      if (result.failure_count === 0) {
        toast.success(`${result.success_count} journal berhasil di-post`)
      } else {
        toast.warning(`${result.success_count} berhasil, ${result.failure_count} gagal`)
      }
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal bulk post journal')),
  })
}
