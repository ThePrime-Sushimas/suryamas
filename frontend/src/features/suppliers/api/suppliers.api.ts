import api from '@/lib/axios'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, SupplierOption, PaginationParams } from '../types/supplier.types'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationParams
  message?: string
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10

export const suppliersApi = {
  list: async (query: SupplierListQuery = {}, signal?: AbortSignal) => {
    const params: Record<string, string | number> = {
      page: query.page || DEFAULT_PAGE,
      limit: query.limit || DEFAULT_LIMIT,
    }
    
    if (query.search) params.search = query.search
    if (query.supplier_type) params.supplier_type = query.supplier_type
    if (query.is_active !== undefined) params.is_active = query.is_active ? 'true' : 'false'
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
    const res = await api.delete<ApiResponse<void>>(`/suppliers/${id}`)
    return res.data
  },

  getOptions: async () => {
    const res = await api.get<ApiResponse<SupplierOption[]>>('/suppliers/options')
    return res.data.data
  },
}