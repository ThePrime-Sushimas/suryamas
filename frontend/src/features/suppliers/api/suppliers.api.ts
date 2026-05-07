import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, SupplierOption, PaginationParams } from '../types/supplier.types'

interface ApiResponse<T> { success: boolean; data: T }
interface PaginatedResponse<T> { success: boolean; data: T[]; pagination: PaginationParams }

// ── React Query Hooks ──

export const useSuppliers = (query: SupplierListQuery = {}) =>
  useQuery({
    queryKey: ['suppliers', query],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page: query.page ?? 1, limit: query.limit ?? 10 }
      if (query.search) params.search = query.search
      if (query.supplier_type) params.supplier_type = query.supplier_type
      if (query.is_active !== undefined) params.is_active = query.is_active
      if (query.include_deleted) params.include_deleted = true
      if (query.sort_by) params.sort_by = query.sort_by
      if (query.sort_order) params.sort_order = query.sort_order
      const { data } = await api.get<PaginatedResponse<Supplier>>('/suppliers', { params })
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useSupplier = (id: string) =>
  useQuery({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Supplier>>(`/suppliers/${id}`)
      return data.data
    },
    enabled: !!id,
  })

export const useCreateSupplier = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateSupplierDto) => {
      const { data } = await api.post<ApiResponse<Supplier>>('/suppliers', body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export const useUpdateSupplier = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSupplierDto & { id: string }) => {
      const { data } = await api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, body)
      return data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['suppliers', vars.id] })
    },
  })
}

export const useDeleteSupplier = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/suppliers/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export const useRestoreSupplier = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<Supplier>>(`/suppliers/${id}/restore`)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

// ── Legacy API object (used by supplier-products, pricelists) ──

export const suppliersApi = {
  list: async (query: SupplierListQuery = {}, signal?: AbortSignal) => {
    const params: Record<string, string | number> = { page: query.page || 1, limit: query.limit || 10 }
    if (query.search) params.search = query.search
    if (query.supplier_type) params.supplier_type = query.supplier_type
    if (query.is_active !== undefined) params.is_active = query.is_active ? 'true' : 'false'
    if (query.include_deleted !== undefined) params.include_deleted = query.include_deleted ? 'true' : 'false'
    if (query.sort_by) params.sort_by = query.sort_by
    if (query.sort_order) params.sort_order = query.sort_order
    const res = await api.get<PaginatedResponse<Supplier>>('/suppliers', { params, signal })
    return res.data
  },
  getById: async (id: string) => {
    const res = await api.get<ApiResponse<Supplier>>(`/suppliers/${id}`)
    return res.data.data
  },
  create: async (data: CreateSupplierDto) => {
    const res = await api.post<ApiResponse<Supplier>>('/suppliers', data)
    return res.data.data
  },
  update: async (id: string, data: UpdateSupplierDto) => {
    const res = await api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data)
    return res.data.data
  },
  delete: async (id: string) => {
    await api.delete(`/suppliers/${id}`)
  },
  getOptions: async () => {
    const res = await api.get<ApiResponse<SupplierOption[]>>('/suppliers/options')
    return res.data.data
  },
  restore: async (id: string) => {
    const res = await api.post<ApiResponse<Supplier>>(`/suppliers/${id}/restore`)
    return res.data.data
  },
}
