import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

// ─── Type Unions ──────────────────────────────────────────────────────────────

export type AssetStatus = 'DRAFT' | 'ACTIVE' | 'MAINTENANCE' | 'DISPOSED'
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE'
export type DisposalMethod = 'SOLD' | 'SCRAPPED' | 'DONATED'
export type MovementType =
  | 'CAPITALIZE'
  | 'DEPRECIATION'
  | 'TRANSFER'
  | 'MAINTENANCE'
  | 'MAINTENANCE_COMPLETE'
  | 'DISPOSAL'
  | 'COST_ADJUSTMENT'
  | 'OPENING_BALANCE'
export type MaintenanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'POSTED'
export type DepreciationRunStatus = 'PREVIEW' | 'POSTED' | 'REVERSED'
export type TrackingMethod = 'INDIVIDUAL' | 'POOLED'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AssetCategory {
  id: string
  company_id: string
  category_code: string
  category_name: string
  asset_coa_id: string
  depreciation_expense_coa_id: string
  accumulated_depreciation_coa_id: string
  default_useful_life_months: number
  tracking_method: TrackingMethod
  is_active: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined COA info
  asset_coa_code?: string
  asset_coa_name?: string
  depreciation_expense_coa_code?: string
  depreciation_expense_coa_name?: string
  accumulated_depreciation_coa_code?: string
  accumulated_depreciation_coa_name?: string
}

export interface FixedAsset {
  id: string
  company_id: string
  branch_id: string
  asset_code: string
  asset_name: string
  asset_category_id: string
  product_id: string | null
  status: AssetStatus
  acquisition_date: string
  capitalized_date: string | null
  cost: number
  salvage_value: number
  useful_life_months: number
  depreciation_method: DepreciationMethod
  accumulated_depreciation: number
  book_value: number
  quantity: number
  uom: string
  gr_line_id: string | null
  purchase_invoice_id: string | null
  journal_id: string | null
  qr_code_url: string | null
  photo_url: string | null
  description: string | null
  serial_number: string | null
  location_note: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined fields from list queries
  category_name?: string
  category_code?: string
  branch_name?: string
  branch_code?: string
  tracking_method?: TrackingMethod
  thumbnail_url?: string | null
}

export interface AssetTransfer {
  id: string
  company_id: string
  fixed_asset_id: string
  transfer_date: string
  source_branch_id: string
  destination_branch_id: string
  reason: string | null
  transferred_by: string | null
  created_at: string
  created_by: string | null
  // Joined fields
  asset_code?: string
  asset_name?: string
  source_branch_name?: string
  destination_branch_name?: string
}

export interface AssetMaintenance {
  id: string
  company_id: string
  fixed_asset_id: string
  maintenance_date: string
  completion_date: string | null
  description: string
  vendor_id: string | null
  vendor_name: string | null
  cost: number
  reference_number: string | null
  status: MaintenanceStatus
  journal_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined fields
  asset_code?: string
  asset_name?: string
  asset_branch_id?: string
}

export interface AssetDisposal {
  id: string
  company_id: string
  fixed_asset_id: string
  disposal_date: string
  disposal_method: DisposalMethod
  proceeds_amount: number
  book_value_at_disposal: number
  gain_loss_amount: number
  quantity_disposed: number | null
  status: 'DRAFT' | 'POSTED'
  journal_id: string | null
  notes: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined fields
  asset_code?: string
  asset_name?: string
}

export interface DepreciationRun {
  id: string
  company_id: string
  fiscal_period_id: string
  run_date: string
  status: DepreciationRunStatus
  total_depreciation_amount: number
  asset_count: number
  journal_ids: string[]
  reversal_journal_ids: string[]
  reversed_at: string | null
  reversed_by: string | null
  created_at: string
  created_by: string | null
  // Joined fields
  period_name?: string
}

export interface DepreciationPreviewEntry {
  fixed_asset_id: string
  asset_code: string
  asset_name: string
  cost: number
  salvage_value: number
  useful_life_months: number
  accumulated_before: number
  depreciation_amount: number
  accumulated_after: number
  book_value_after: number
}

export interface DepreciationRunResult {
  run_id: string
  status: DepreciationRunStatus
  fiscal_period_id: string
  total_depreciation_amount: number
  asset_count: number
  entries: DepreciationPreviewEntry[]
  journal_ids?: string[]
}

export interface AssetMovement {
  id: string
  company_id: string
  fixed_asset_id: string
  movement_type: MovementType
  movement_date: string
  from_value: string | null
  to_value: string | null
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateCategoryDto {
  category_code: string
  category_name: string
  asset_coa_id: string
  depreciation_expense_coa_id: string
  accumulated_depreciation_coa_id: string
  default_useful_life_months: number
  tracking_method?: TrackingMethod
}

export interface UpdateCategoryDto {
  category_name?: string
  asset_coa_id?: string
  depreciation_expense_coa_id?: string
  accumulated_depreciation_coa_id?: string
  default_useful_life_months?: number
  tracking_method?: TrackingMethod
  is_active?: boolean
}

export interface UpdateAssetDto {
  asset_name?: string
  description?: string | null
  serial_number?: string | null
  location_note?: string | null
  photo_url?: string | null
  salvage_value?: number
  useful_life_months?: number
}

export interface CreateTransferDto {
  fixed_asset_id: string
  destination_branch_id: string
  transfer_date?: string
  reason?: string
}

export interface CreateMaintenanceDto {
  fixed_asset_id: string
  maintenance_date: string
  description: string
  vendor_id: string
}

export interface CreateDisposalDto {
  fixed_asset_id: string
  disposal_date: string
  disposal_method: DisposalMethod
  proceeds_amount: number
  quantity_disposed?: number | null
  notes?: string
}

export interface DepreciationPreviewDto {
  fiscal_period_id: string
}

export interface DepreciationConfirmDto {
  fiscal_period_id: string
}

// ─── Pagination ──────────────────────────────────────────────────────────────

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}


// ─── Query Keys ──────────────────────────────────────────────────────────────

const KEYS = {
  categories: (params?: Record<string, unknown>) => ['asset-categories', params] as const,
  categoryDetail: (id: string) => ['asset-categories', id] as const,
  assets: (params?: Record<string, unknown>) => ['fixed-assets', params] as const,
  assetDetail: (id: string) => ['fixed-assets', id] as const,
  assetMovements: (assetId: string) => ['fixed-assets', assetId, 'movements'] as const,
  transfers: (params?: Record<string, unknown>) => ['asset-transfers', params] as const,
  maintenance: (params?: Record<string, unknown>) => ['asset-maintenance', params] as const,
  disposals: (params?: Record<string, unknown>) => ['asset-disposals', params] as const,
  depreciationRuns: (params?: Record<string, unknown>) => ['depreciation-runs', params] as const,
}

// ─── Asset Categories ────────────────────────────────────────────────────────

export const useCategories = (params?: {
  page?: number
  limit?: number
  search?: string
  is_active?: boolean
  enabled?: boolean
}) =>
  useQuery({
    queryKey: KEYS.categories(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 25,
      }
      if (params?.search) queryParams.search = params.search
      if (params?.is_active !== undefined) queryParams.is_active = params.is_active

      const { data } = await api.get('/asset-categories', { params: queryParams })
      return {
        data: data.data as AssetCategory[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
    enabled: params?.enabled ?? true,
  })

export const useCategory = (id: string) =>
  useQuery({
    queryKey: KEYS.categoryDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/asset-categories/${id}`)
      return data.data as AssetCategory
    },
    enabled: !!id,
  })

export const useCreateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateCategoryDto) => {
      const { data } = await api.post('/asset-categories', body)
      return data.data as AssetCategory
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-categories'] })
    },
  })
}

export const useUpdateCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateCategoryDto }) => {
      const { data } = await api.put(`/asset-categories/${id}`, body)
      return data.data as AssetCategory
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['asset-categories'] })
      qc.invalidateQueries({ queryKey: KEYS.categoryDetail(vars.id) })
    },
  })
}

export const useDeleteCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/asset-categories/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-categories'] })
    },
  })
}

export const useRestoreCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/asset-categories/${id}/restore`)
      return data.data as AssetCategory
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['asset-categories'] })
      qc.invalidateQueries({ queryKey: KEYS.categoryDetail(id) })
    },
  })
}

// ─── Fixed Assets ────────────────────────────────────────────────────────────

export const useAssets = (params?: {
  page?: number
  limit?: number
  search?: string
  status?: AssetStatus | ''
  asset_category_id?: string
  branch_id?: string
  date_from?: string
  date_to?: string
}) =>
  useQuery({
    queryKey: KEYS.assets(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 25,
      }
      if (params?.search) queryParams.search = params.search
      if (params?.status) queryParams.status = params.status
      if (params?.asset_category_id) queryParams.asset_category_id = params.asset_category_id
      if (params?.branch_id) queryParams.branch_id = params.branch_id
      if (params?.date_from) queryParams.date_from = params.date_from
      if (params?.date_to) queryParams.date_to = params.date_to

      const { data } = await api.get('/fixed-assets', { params: queryParams })
      return {
        data: data.data as FixedAsset[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useAsset = (id: string) =>
  useQuery({
    queryKey: KEYS.assetDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/fixed-assets/${id}`)
      return data.data as FixedAsset
    },
    enabled: !!id,
  })

export const useUpdateAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateAssetDto }) => {
      const { data } = await api.put(`/fixed-assets/${id}`, body)
      return data.data as FixedAsset
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
      qc.invalidateQueries({ queryKey: KEYS.assetDetail(vars.id) })
    },
  })
}

// ─── Asset Movements ─────────────────────────────────────────────────────────

export const useAssetMovements = (
  assetId: string,
  params?: { page?: number; limit?: number; movement_type?: MovementType | '' },
) =>
  useQuery({
    queryKey: [...KEYS.assetMovements(assetId), params],
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      }
      if (params?.movement_type) queryParams.movement_type = params.movement_type

      const { data } = await api.get(`/fixed-assets/${assetId}/movements`, { params: queryParams })
      return {
        data: data.data as AssetMovement[],
        pagination: data.pagination as Pagination,
      }
    },
    enabled: !!assetId,
  })

// ─── Activate Asset (DRAFT → ACTIVE) ─────────────────────────────────────────

export interface ActivateAssetDto {
  capitalized_date?: string
}

export const useActivateAsset = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body?: ActivateAssetDto }) => {
      const { data } = await api.post(`/fixed-assets/${id}/activate`, body)
      return data.data as FixedAsset
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
      qc.invalidateQueries({ queryKey: KEYS.assetDetail(vars.id) })
    },
  })
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

export const useRegenerateQrCode = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { data } = await api.post(`/fixed-assets/${assetId}/qr-code`)
      return data.data as FixedAsset
    },
    onSuccess: (_data, assetId) => {
      qc.invalidateQueries({ queryKey: KEYS.assetDetail(assetId) })
    },
  })
}

export const useBulkQrPdf = () =>
  useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { data } = await api.post('/fixed-assets/bulk-qr', { asset_ids: assetIds }, {
        responseType: 'blob',
      })
      return data as Blob
    },
  })


// ─── Asset Transfers ─────────────────────────────────────────────────────────

export const useTransfers = (params?: {
  page?: number
  limit?: number
  fixed_asset_id?: string
  branch_id?: string
  date_from?: string
  date_to?: string
}) =>
  useQuery({
    queryKey: KEYS.transfers(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 25,
      }
      if (params?.fixed_asset_id) queryParams.fixed_asset_id = params.fixed_asset_id
      if (params?.branch_id) queryParams.branch_id = params.branch_id
      if (params?.date_from) queryParams.date_from = params.date_from
      if (params?.date_to) queryParams.date_to = params.date_to

      const { data } = await api.get('/asset-transfers', { params: queryParams })
      return {
        data: data.data as AssetTransfer[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useCreateTransfer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateTransferDto) => {
      const { data } = await api.post('/asset-transfers', body)
      return data.data as AssetTransfer
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-transfers'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

// ─── Asset Maintenance ───────────────────────────────────────────────────────

export const useMaintenance = (params?: {
  page?: number
  limit?: number
  fixed_asset_id?: string
  status?: MaintenanceStatus | ''
  search?: string
  date_from?: string
  date_to?: string
}) =>
  useQuery({
    queryKey: KEYS.maintenance(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 25,
      }
      if (params?.fixed_asset_id) queryParams.fixed_asset_id = params.fixed_asset_id
      if (params?.status) queryParams.status = params.status
      if (params?.search) queryParams.search = params.search
      if (params?.date_from) queryParams.date_from = params.date_from
      if (params?.date_to) queryParams.date_to = params.date_to

      const { data } = await api.get('/asset-maintenance', { params: queryParams })
      return {
        data: data.data as AssetMaintenance[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useCreateMaintenance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateMaintenanceDto) => {
      const { data } = await api.post('/asset-maintenance', body)
      return data.data as AssetMaintenance
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-maintenance'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

export const useCompleteMaintenance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/asset-maintenance/${id}/complete`)
      return data.data as AssetMaintenance
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-maintenance'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

// ─── Asset Disposals ─────────────────────────────────────────────────────────

export const useDisposals = (params?: {
  page?: number
  limit?: number
  fixed_asset_id?: string
  status?: 'DRAFT' | 'POSTED' | ''
  disposal_method?: DisposalMethod | ''
  date_from?: string
  date_to?: string
}) =>
  useQuery({
    queryKey: KEYS.disposals(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 25,
      }
      if (params?.fixed_asset_id) queryParams.fixed_asset_id = params.fixed_asset_id
      if (params?.status) queryParams.status = params.status
      if (params?.disposal_method) queryParams.disposal_method = params.disposal_method
      if (params?.date_from) queryParams.date_from = params.date_from
      if (params?.date_to) queryParams.date_to = params.date_to

      const { data } = await api.get('/asset-disposals', { params: queryParams })
      return {
        data: data.data as AssetDisposal[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useCreateDisposal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateDisposalDto) => {
      const { data } = await api.post('/asset-disposals', body)
      return data.data as AssetDisposal
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-disposals'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

export const usePostDisposal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/asset-disposals/${id}/post`)
      return data.data as AssetDisposal
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-disposals'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

// ─── Depreciation Runs ───────────────────────────────────────────────────────

export const useDepreciationRuns = (params?: {
  page?: number
  limit?: number
  status?: DepreciationRunStatus | ''
  fiscal_period_id?: string
}) =>
  useQuery({
    queryKey: KEYS.depreciationRuns(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 25,
      }
      if (params?.status) queryParams.status = params.status
      if (params?.fiscal_period_id) queryParams.fiscal_period_id = params.fiscal_period_id

      const { data } = await api.get('/depreciation-runs', { params: queryParams })
      return {
        data: data.data as DepreciationRun[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const usePreviewDepreciation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: DepreciationPreviewDto) => {
      const { data } = await api.post('/depreciation-runs/preview', body)
      return data.data as DepreciationRunResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depreciation-runs'] })
    },
  })
}

export const useConfirmDepreciation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: DepreciationConfirmDto) => {
      const { data } = await api.post('/depreciation-runs/confirm', body)
      return data.data as DepreciationRunResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depreciation-runs'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

export const useReverseDepreciation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/depreciation-runs/${id}/reverse`)
      return data.data as DepreciationRunResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['depreciation-runs'] })
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}

// ─── Asset Photos ────────────────────────────────────────────────────────────

export interface AssetPhoto {
  id: string
  fixed_asset_id: string
  company_id: string
  file_path: string
  file_name: string
  file_size: number
  sort_order: number
  uploaded_by: string | null
  created_at: string
  url: string
}

export const useAssetPhotos = (assetId: string) =>
  useQuery({
    queryKey: ['fixed-assets', assetId, 'photos'],
    queryFn: async () => {
      const { data } = await api.get(`/fixed-assets/${assetId}/photos`)
      return data.data as AssetPhoto[]
    },
    enabled: !!assetId,
    staleTime: 30_000,
  })

export const useUploadAssetPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ assetId, file }: { assetId: string; file: File }) => {
      const formData = new FormData()
      formData.append('photo', file)
      const { data } = await api.post(`/fixed-assets/${assetId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data as AssetPhoto
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fixed-assets', vars.assetId, 'photos'] })
    },
  })
}

export const useDeleteAssetPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ assetId, photoId }: { assetId: string; photoId: string }) => {
      await api.delete(`/fixed-assets/${assetId}/photos/${photoId}`)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fixed-assets', vars.assetId, 'photos'] })
    },
  })
}

// ─── Opening Balance ─────────────────────────────────────────────────────────

export interface EquityAccount {
  id: string
  account_code: string
  account_name: string
}

export interface CreateOpeningBalanceDto {
  branch_id: string
  asset_category_id: string
  product_id: string
  asset_name: string
  acquisition_date: string
  cost: number
  salvage_value: number
  useful_life_months?: number
  accumulated_depreciation: number
  quantity?: number
  uom?: string
  equity_coa_id: string
  serial_number?: string | null
  location_note?: string | null
  description?: string | null
  notes?: string | null
}

export interface DepreciationPreviewResponse {
  months_elapsed: number
  estimated_accumulated_depreciation: number
  estimated_book_value: number
  monthly_depreciation: number
  is_fully_depreciated: boolean
}

export const useEquityAccounts = () =>
  useQuery({
    queryKey: ['fixed-assets', 'equity-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/asset-opening-balance/equity-accounts')
      return data.data as EquityAccount[]
    },
    staleTime: 5 * 60_000,
  })

export const useDepreciationPreview = (params: {
  acquisition_date: string
  cost: number
  salvage_value: number
  useful_life_months: number
} | null) =>
  useQuery({
    queryKey: ['fixed-assets', 'depreciation-preview', params],
    queryFn: async () => {
      const { data } = await api.get('/asset-opening-balance/preview-depreciation', { params })
      return data.data as DepreciationPreviewResponse
    },
    enabled: !!params && !!params.acquisition_date && params.cost > 0 && params.useful_life_months > 0,
    staleTime: 0,
  })

export const useCreateOpeningBalance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateOpeningBalanceDto) => {
      const { data } = await api.post('/asset-opening-balance', body)
      return data.data as FixedAsset & { journal_id: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
    },
  })
}
