import api from '@/lib/axios'
import type { AccountingPurpose, CreateAccountingPurposeDto, UpdateAccountingPurposeDto, SortParams, FilterParams, PaginationParams } from '../types/accounting-purpose.types'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationParams
}

interface ListParams {
  page: number
  limit: number
  sort?: string
  order?: 'asc' | 'desc'
  applied_to?: string
  is_active?: boolean
  show_deleted?: boolean
  q?: string
  company_id: string
}

const handleApiCall = async <T>(
  apiCall: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<T> => {
  try {
    return await apiCall()
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      const message = axiosError.response?.data?.error || errorMessage
      throw new Error(message)
    }
    throw new Error(errorMessage)
  }
}

class RequestManager {
  private controllers = new Map<string, AbortController>()
  
  getSignal(key: string): AbortSignal {
    this.abort(key)
    const controller = new AbortController()
    this.controllers.set(key, controller)
    return controller.signal
  }
  
  abort(key: string) {
    const controller = this.controllers.get(key)
    if (controller) {
      controller.abort()
      this.controllers.delete(key)
    }
  }
  
  cleanup(key: string) {
    this.controllers.delete(key)
  }
}

const requestManager = new RequestManager()

export const accountingPurposesApi = {
  list: async (page = 1, limit = 25, sort?: SortParams | null, filter?: FilterParams | null) => {
    return handleApiCall(async () => {
      const signal = requestManager.getSignal('accounting-purposes:list')
      
      const params: Omit<ListParams, 'company_id'> = { page, limit }
      if (sort) {
        params.sort = sort.field
        params.order = sort.order
      }
      if (filter) {
        Object.assign(params, filter)
      }
      
      console.log('API request params:', params)
      
      const res = await api.get<PaginatedResponse<AccountingPurpose>>('/accounting-purposes', { 
        params,
        signal
      })
      requestManager.cleanup('accounting-purposes:list')
      return res.data
    }, 'Failed to fetch accounting purposes')
  },

  getById: async (id: string) => {
    return handleApiCall(async () => {
      const res = await api.get<ApiResponse<AccountingPurpose>>(`/accounting-purposes/${id}`)
      return res.data.data
    }, 'Failed to fetch accounting purpose')
  },

  create: async (data: CreateAccountingPurposeDto) => {
    return handleApiCall(async () => {
      const res = await api.post<ApiResponse<AccountingPurpose>>('/accounting-purposes', data)
      return res.data.data
    }, 'Failed to create accounting purpose')
  },

  update: async (id: string, data: UpdateAccountingPurposeDto) => {
    return handleApiCall(async () => {
      const res = await api.put<ApiResponse<AccountingPurpose>>(`/accounting-purposes/${id}`, data)
      return res.data.data
    }, 'Failed to update accounting purpose')
  },

  delete: async (id: string) => {
    return handleApiCall(async () => {
      await api.delete(`/accounting-purposes/${id}`)
    }, 'Failed to delete accounting purpose')
  },

  restore: async (id: string) => {
    return handleApiCall(async () => {
      await api.post(`/accounting-purposes/${id}/restore`)
    }, 'Failed to restore accounting purpose')
  },

  bulkDelete: async (ids: string[]) => {
    return handleApiCall(async () => {
      await api.post('/accounting-purposes/bulk/delete', { ids })
    }, 'Failed to bulk delete accounting purposes')
  },

  bulkRestore: async (ids: string[]) => {
    return handleApiCall(async () => {
      await api.post('/accounting-purposes/bulk/restore', { ids })
    }, 'Failed to bulk restore accounting purposes')
  },

  search: async (q: string) => {
    return handleApiCall(async () => {
      const res = await api.get<PaginatedResponse<AccountingPurpose>>('/accounting-purposes/search', {
        params: { q }
      })
      return res.data
    }, 'Failed to search accounting purposes')
  }
}