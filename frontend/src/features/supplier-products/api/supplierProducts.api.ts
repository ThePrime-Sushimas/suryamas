import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  SupplierProduct, SupplierProductWithRelations, CreateSupplierProductDto,
  UpdateSupplierProductDto, SupplierProductListQuery, SupplierProductOption, PaginationParams
} from '../types/supplier-product.types'

interface ApiResponse<T> { success: boolean; data: T }
interface PaginatedResponse<T> { success: boolean; data: T[]; pagination: PaginationParams }

const buildParams = (query: SupplierProductListQuery): Record<string, string | number | boolean> => {
  const p: Record<string, string | number | boolean> = { page: query.page || 1, limit: query.limit || 10, include_relations: true }
  if (query.search) p.search = query.search
  if (query.supplier_id) p.supplier_id = query.supplier_id
  if (query.product_id) p.product_id = query.product_id
  if (query.is_preferred !== undefined) p.is_preferred = query.is_preferred
  if (query.is_active !== undefined) p.is_active = query.is_active
  if (query.include_deleted) p.include_deleted = true
  if (query.sort_by) p.sort_by = query.sort_by
  if (query.sort_order) p.sort_order = query.sort_order
  return p
}

// ── React Query Hooks ──

export const useSupplierProducts = (query: SupplierProductListQuery = {}) =>
  useQuery({
    queryKey: ['supplier-products', query],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<SupplierProductWithRelations>>('/supplier-products', { params: buildParams(query) })
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useSupplierProduct = (id: string) =>
  useQuery({
    queryKey: ['supplier-products', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SupplierProductWithRelations>>(`/supplier-products/${id}`, { params: { include_relations: true } })
      return data.data
    },
    enabled: !!id,
  })

export const useCreateSupplierProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateSupplierProductDto) => {
      const { data } = await api.post<ApiResponse<SupplierProduct>>('/supplier-products', body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-products'] }),
  })
}

export const useUpdateSupplierProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSupplierProductDto & { id: string }) => {
      const { data } = await api.put<ApiResponse<SupplierProduct>>(`/supplier-products/${id}`, body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-products'] }),
  })
}

export const useDeleteSupplierProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/supplier-products/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-products'] }),
  })
}

export const useRestoreSupplierProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<SupplierProduct>>(`/supplier-products/${id}/restore`)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-products'] }),
  })
}

// ── Legacy API object (used by pricelists feature) ──

export const supplierProductsApi = {
  list: async (query: SupplierProductListQuery = {}, signal?: AbortSignal, includeRelations = true) => {
    const params = { ...buildParams(query), include_relations: includeRelations }
    const res = await api.get<PaginatedResponse<SupplierProductWithRelations>>('/supplier-products', { params, signal, timeout: 30000 })
    return res.data
  },
  getById: async (id: string, includeRelations = true, includeDeleted = false, signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations>>(`/supplier-products/${id}`, {
      params: { include_relations: includeRelations, include_deleted: includeDeleted }, signal
    })
    return res.data.data
  },
  getBySupplier: async (supplierId: string, includeRelations = true, signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations[]>>(`/supplier-products/supplier/${supplierId}`, {
      params: { include_relations: includeRelations }, signal
    })
    return res.data.data
  },
  getByProduct: async (productId: string, includeRelations = true, signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations[]>>(`/supplier-products/product/${productId}`, {
      params: { include_relations: includeRelations }, signal
    })
    return res.data.data
  },
  getActiveOptions: async (signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductOption[]>>('/supplier-products/options/active', { signal })
    return res.data.data
  },
  create: async (data: CreateSupplierProductDto) => { const res = await api.post<ApiResponse<SupplierProduct>>('/supplier-products', data); return res.data.data },
  update: async (id: string, data: UpdateSupplierProductDto) => { const res = await api.put<ApiResponse<SupplierProduct>>(`/supplier-products/${id}`, data); return res.data.data },
  delete: async (id: string) => { await api.delete(`/supplier-products/${id}`) },
  bulkDelete: async (ids: string[]) => { await api.post('/supplier-products/bulk/delete', { ids }) },
  restore: async (id: string) => { const res = await api.post<ApiResponse<SupplierProduct>>(`/supplier-products/${id}/restore`); return res.data.data },
  bulkRestore: async (ids: string[]) => { await api.post('/supplier-products/bulk/restore', { ids }) },
  exportCSV: async (query: SupplierProductListQuery = {}) => {
    const res = await api.get('/supplier-products/export', { params: buildParams(query), responseType: 'blob' })
    return res.data
  },
}
