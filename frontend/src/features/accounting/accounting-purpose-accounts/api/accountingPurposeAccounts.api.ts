import api from '@/lib/axios'
import type { 
  AccountingPurposeAccountWithDetails, 
  CreateAccountingPurposeAccountDto, 
  UpdateAccountingPurposeAccountDto,
  BulkCreateAccountingPurposeAccountDto,
  BulkRemoveAccountingPurposeAccountDto,
  AccountingPurposeAccountFilter,
  ChartOfAccount,
  AccountingPurpose
} from '../types/accounting-purpose-account.types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

const appendFilterParams = (params: URLSearchParams, filter?: AccountingPurposeAccountFilter) => {
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      params.append(key, String(value))
    })
  }
}

export const accountingPurposeAccountsApi = {
  list: async (page: number, limit: number, sort?: { field: string; order: string }, filter?: AccountingPurposeAccountFilter) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (sort?.field && sort?.order) {
      params.append('sort', sort.field)
      params.append('order', sort.order)
    }
    appendFilterParams(params, filter)
    const res = await api.get<PaginatedResponse<AccountingPurposeAccountWithDetails>>(`/accounting-purpose-accounts?${params}`)
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<AccountingPurposeAccountWithDetails>>(`/accounting-purpose-accounts/${id}`)
    return res.data.data
  },

  create: async (data: CreateAccountingPurposeAccountDto) => {
    const res = await api.post<ApiResponse<AccountingPurposeAccountWithDetails>>('/accounting-purpose-accounts', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateAccountingPurposeAccountDto) => {
    const res = await api.put<ApiResponse<AccountingPurposeAccountWithDetails>>(`/accounting-purpose-accounts/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/accounting-purpose-accounts/${id}`)
  },

  bulkCreate: async (data: BulkCreateAccountingPurposeAccountDto) => {
    const res = await api.post<ApiResponse<AccountingPurposeAccountWithDetails[]>>('/accounting-purpose-accounts/bulk/create', data)
    return res.data.data
  },

  bulkRemove: async (data: BulkRemoveAccountingPurposeAccountDto) => {
    await api.post('/accounting-purpose-accounts/bulk/remove', data)
  },

  bulkUpdateStatus: async (ids: string[], is_active: boolean) => {
    await api.post('/accounting-purpose-accounts/bulk/status', { ids, is_active })
  },

  exportToken: async () => {
    const res = await api.get<ApiResponse<{ token: string }>>('/accounting-purpose-accounts/export/token')
    return res.data.data.token
  },

  export: async (token: string, filter?: AccountingPurposeAccountFilter) => {
    const params = new URLSearchParams()
    params.append('token', token)
    appendFilterParams(params, filter)
    const res = await api.get(`/accounting-purpose-accounts/export?${params}`, { responseType: 'blob' })
    return res.data
  },

  // Helper APIs for dropdowns
  getPostableAccounts: async (limit: number = 1000) => {
    const res = await api.get<PaginatedResponse<ChartOfAccount>>(`/chart-of-accounts?is_postable=true&is_active=true&limit=${limit}`)
    return res.data.data
  },

  getActivePurposes: async (limit: number = 1000) => {
    const res = await api.get<PaginatedResponse<AccountingPurpose>>(`/accounting-purposes?is_active=true&limit=${limit}`)
    return res.data.data
  }
}