import api from '@/lib/axios'
import type { PaymentTerm, CreatePaymentTermDto, UpdatePaymentTermDto, SortParams, FilterParams, PaginationParams, MinimalPaymentTerm } from '../types'

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
  calculation_type?: string
  is_active?: boolean
  q?: string
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

export const paymentTermsApi = {
  list: async (page = 1, limit = 25, sort?: SortParams | null, filter?: FilterParams | null) => {
    return handleApiCall(async () => {
      const signal = requestManager.getSignal('payment-terms:list')
      
      const params: ListParams = { page, limit }
      if (sort) {
        params.sort = sort.field
        params.order = sort.order
      }
      if (filter) {
        Object.assign(params, filter)
      }
      
      try {
        const res = await api.get<PaginatedResponse<PaymentTerm>>('/payment-terms', { 
          params,
          signal
        })
        requestManager.cleanup('payment-terms:list')
        return res.data
      } catch (error) {
        requestManager.cleanup('payment-terms:list')
        throw error
      }
    }, 'Failed to fetch payment terms')
  },

  minimalActive: async () => {
    return handleApiCall(async () => {
      const res = await api.get<ApiResponse<MinimalPaymentTerm[]>>('/payment-terms/minimal/active')
      return res.data.data
    }, 'Failed to fetch active payment terms')
  },

  getById: async (id: number) => {
    return handleApiCall(async () => {
      const res = await api.get<ApiResponse<PaymentTerm>>(`/payment-terms/${id}`)
      return res.data.data
    }, 'Failed to fetch payment term')
  },

  create: async (data: CreatePaymentTermDto) => {
    return handleApiCall(async () => {
      const res = await api.post<ApiResponse<PaymentTerm>>('/payment-terms', data)
      return res.data.data
    }, 'Failed to create payment term')
  },

  update: async (id: number, data: UpdatePaymentTermDto) => {
    return handleApiCall(async () => {
      const res = await api.put<ApiResponse<PaymentTerm>>(`/payment-terms/${id}`, data)
      return res.data.data
    }, 'Failed to update payment term')
  },

  delete: async (id: number) => {
    return handleApiCall(async () => {
      await api.delete(`/payment-terms/${id}`)
    }, 'Failed to delete payment term')
  },

  restore: async (id: number) => {
    return handleApiCall(async () => {
      const res = await api.post<ApiResponse<PaymentTerm>>(`/payment-terms/${id}/restore`)
      return res.data.data
    }, 'Failed to restore payment term')
  }
}
