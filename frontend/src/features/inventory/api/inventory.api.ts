import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Warehouse, CreateWarehouseDto, UpdateWarehouseDto, StockBalance, StockMovement, Pagination } from '../types'

// ─── QUERY KEYS ─────────────────────────────────────────────────────────────

const KEYS = {
  warehouses: (params: Record<string, unknown>) => ['warehouses', params] as const,
  warehouse: (id: string) => ['warehouses', id] as const,
  warehousesByBranch: (branchId: string) => ['warehouses', 'branch', branchId] as const,
  stockBalances: (params: Record<string, unknown>) => ['stock', 'balances', params] as const,
  stockMovements: (params: Record<string, unknown>) => ['stock', 'movements', params] as const,
  productHistory: (warehouseId: string, productId: string) => ['stock', 'history', warehouseId, productId] as const,
}

// ─── WAREHOUSES ─────────────────────────────────────────────────────────────

export const useWarehouses = (params: { page?: number; limit?: number; search?: string; branch_id?: string; warehouse_type?: string; is_active?: string }) =>
  useQuery({
    queryKey: KEYS.warehouses(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.search) queryParams.q = params.search
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.warehouse_type) queryParams.warehouse_type = params.warehouse_type
      if (params.is_active) queryParams.is_active = params.is_active

      const endpoint = params.search ? '/warehouses/search' : '/warehouses'
      const { data } = await api.get(endpoint, { params: queryParams })
      return { data: data.data as Warehouse[], pagination: data.pagination as Pagination }
    },
    staleTime: 60_000,
  })

export const useWarehousesByBranch = (branchId: string) =>
  useQuery({
    queryKey: KEYS.warehousesByBranch(branchId),
    queryFn: async () => {
      const { data } = await api.get(`/warehouses/branch/${branchId}`)
      return data.data as Warehouse[]
    },
    enabled: !!branchId,
  })

export const useCreateWarehouse = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateWarehouseDto) => {
      const { data } = await api.post('/warehouses', body)
      return data.data as Warehouse
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  })
}

export const useUpdateWarehouse = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateWarehouseDto & { id: string }) => {
      const { data } = await api.put(`/warehouses/${id}`, body)
      return data.data as Warehouse
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  })
}

export const useDeleteWarehouse = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/warehouses/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  })
}

// ─── STOCK BALANCES ─────────────────────────────────────────────────────────

export const useStockBalances = (params: { page?: number; limit?: number; search?: string; warehouse_id?: string; branch_id?: string; warehouse_type?: string; has_stock?: string }) =>
  useQuery({
    queryKey: KEYS.stockBalances(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 50 }
      if (params.search) queryParams.search = params.search
      if (params.warehouse_id) queryParams.warehouse_id = params.warehouse_id
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.warehouse_type) queryParams.warehouse_type = params.warehouse_type
      if (params.has_stock) queryParams.has_stock = params.has_stock

      const { data } = await api.get('/stock/balances', { params: queryParams })
      return { data: data.data as StockBalance[], pagination: data.pagination as Pagination }
    },
    staleTime: 30_000,
  })

// ─── STOCK MOVEMENTS ────────────────────────────────────────────────────────

export const useStockMovements = (params: { page?: number; limit?: number; warehouse_id?: string; product_id?: string; movement_type?: string; date_from?: string; date_to?: string }) =>
  useQuery({
    queryKey: KEYS.stockMovements(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 50 }
      if (params.warehouse_id) queryParams.warehouse_id = params.warehouse_id
      if (params.product_id) queryParams.product_id = params.product_id
      if (params.movement_type) queryParams.movement_type = params.movement_type
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to

      const { data } = await api.get('/stock/movements', { params: queryParams })
      return { data: data.data as StockMovement[], pagination: data.pagination as Pagination }
    },
    staleTime: 30_000,
  })

export const useProductHistory = (warehouseId: string, productId: string, params: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: [...KEYS.productHistory(warehouseId, productId), params],
    queryFn: async () => {
      const { data } = await api.get(`/stock/balances/${warehouseId}/${productId}/history`, { params })
      return { data: data.data as StockMovement[], pagination: data.pagination as Pagination }
    },
    enabled: !!warehouseId && !!productId,
  })

// ─── MUTATIONS ──────────────────────────────────────────────────────────────

export const useCreateOpeningBalance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { warehouse_id: string; product_id: string; qty: number; cost_per_unit: number; notes?: string }) => {
      const { data } = await api.post('/stock/opening-balance', body)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export const useBulkOpeningBalance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { warehouse_id: string; items: { product_id: string; qty: number; cost_per_unit: number }[]; notes?: string; movement_date?: string }) => {
      const { data } = await api.post('/stock/opening-balance/bulk', body)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export const useAdjustStock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { warehouse_id: string; product_id: string; new_qty: number; cost_per_unit?: number; reason: string }) => {
      const { data } = await api.post('/stock/adjust', body)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

// ─── STOCK CONFIG ───────────────────────────────────────────────────────────

export interface StockConfigGridRow {
  product_id: string
  product_code: string
  product_name: string
  category_name: string
  base_unit_name: string | null
  configs: {
    branch_id: string
    reorder_point: number | null
    safety_stock: number | null
  }[]
}

export const useStockConfigGrid = () =>
  useQuery({
    queryKey: ['stock', 'config-grid'],
    queryFn: async () => {
      const { data } = await api.get('/stock/configs/grid')
      return data.data as StockConfigGridRow[]
    },
    staleTime: 30_000,
  })

export const useUpsertStockConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      branch_id: string
      product_id: string
      reorder_point?: number | null
      safety_stock?: number | null
    }) => {
      const { data } = await api.put('/stock/configs', body)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock', 'config-grid'] })
    },
  })
}

// ─── REORDER SUGGESTIONS ────────────────────────────────────────────────────

export interface ReorderSuggestionItem {
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  branch_id: string
  branch_name: string
  warehouse_id: string
  warehouse_name: string
  current_qty: number
  reorder_point: number
  safety_stock: number | null
  shortage: number
  is_critical: boolean
  qty_on_order: number
  still_short_after_order: boolean
  preferred_supplier_id: string | null
  preferred_supplier_name: string | null
  lead_time_days: number | null
  last_purchase_price: number | null
  config_source: 'branch' | 'product_default'
}

export const useReorderSuggestions = (branchId?: string) =>
  useQuery({
    queryKey: ['stock', 'reorder-suggestions', branchId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (branchId) params.branch_id = branchId
      const { data } = await api.get('/stock/reorder-suggestions', { params })
      return data.data as ReorderSuggestionItem[]
    },
    staleTime: 60_000,
  })
