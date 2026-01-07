import api from '@/lib/axios'
import type { Bank, BankOption, CreateBankDto, UpdateBankDto, BankListQuery, ApiResponse, PaginationMeta } from '../types'

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationMeta
  message?: string
}

export const banksApi = {
  list: async (query: BankListQuery = {}, signal?: AbortSignal) => {
    const params: Record<string, string | number> = {
      page: query.page || 1,
      limit: query.limit || 10,
    }
    
    if (query.search) params.search = query.search
    if (query.is_active !== undefined) params.is_active = query.is_active ? 'true' : 'false'

    const res = await api.get<PaginatedResponse<Bank>>('/banks', { params, signal })
    return res.data
  },

  getById: async (id: number) => {
    const res = await api.get<ApiResponse<Bank>>(`/banks/${id}`)
    return res.data.data
  },

  create: async (data: CreateBankDto) => {
    const res = await api.post<ApiResponse<Bank>>('/banks', data)
    return res.data.data
  },

  update: async (id: number, data: UpdateBankDto) => {
    const res = await api.put<ApiResponse<Bank>>(`/banks/${id}`, data)
    return res.data.data
  },

  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/banks/${id}`)
    return res.data
  },

  getOptions: async () => {
    const res = await api.get<ApiResponse<BankOption[]>>('/banks/options')
    return res.data.data
  },
}
