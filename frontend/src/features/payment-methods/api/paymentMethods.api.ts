import api from '@/lib/axios'
import type { PaymentMethod, CreatePaymentMethodDto, UpdatePaymentMethodDto, SortParams, FilterParams, PaginationParams, PaymentMethodOption } from '../types'

// Backend API response structure (matches backend sendSuccess format)
interface BackendResponse<T> {
  success: boolean
  message?: string
  data: T
  pagination?: PaginationParams
}

interface ListParams {
  page: number
  limit: number
  sort?: string
  order?: 'asc' | 'desc'
  payment_type?: string
  is_active?: boolean
  requires_bank_account?: boolean
  q?: string
}

// Helper to check if an error is a cancellation error (from AbortController)
const isCanceledError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  
  const err = error as { 
    code?: string
    name?: string
    message?: string
  }
  
  // Check for Axios CanceledError characteristics
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
    return true
  }
  
  // Also check message as fallback
  if (err.message && typeof err.message === 'string' && 
      (err.message.includes('canceled') || err.message.includes('cancelled'))) {
    return true
  }
  
  return false
}

const handleApiCall = async <T>(
  apiCall: () => Promise<T>,
  errorMessage = 'Operation failed',
  context?: string
): Promise<T> => {
  try {
    return await apiCall()
  } catch (error: unknown) {
    // Handle cancellation errors gracefully - these are expected during debouncing/HMR
    if (isCanceledError(error)) {
      // Expected during debouncing/HMR — silence to avoid console noise
      throw new Error('Request was canceled')
    }
    
    // Log full error details for debugging
    console.error(`[PaymentMethods API] Error${context ? ` in ${context}` : ''}:`, {
      errorMessage,
      error,
      isAxiosError: error && typeof error === 'object' && 'isAxiosError' in error,
      hasResponse: error && typeof error === 'object' && 'response' in error,
    })
    
    if (error && typeof error === 'object') {
      const axiosError = error as { 
        response?: { 
          data?: { 
            error?: string
            message?: string
            success?: boolean
          } 
          status?: number
        }
        message?: string
      }
      
      // Try to get error message from various possible locations
      const backendError = axiosError.response?.data?.error
      const backendMessage = axiosError.response?.data?.message
      const statusCode = axiosError.response?.status
      
      if (backendError) {
        throw new Error(backendError)
      }
      if (backendMessage && !backendMessage.includes('Success')) {
        throw new Error(backendMessage)
      }
      if (statusCode === 401) {
        throw new Error('Sesi telah berakhir, silakan login kembali')
      }
      if (statusCode === 403) {
        throw new Error('Anda tidak memiliki akses ke fitur ini')
      }
      if (statusCode === 404) {
        throw new Error('Data tidak ditemukan')
      }
      if (axiosError.message) {
        throw new Error(axiosError.message)
      }
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

export const paymentMethodsApi = {
  list: async (page = 1, limit = 25, sort?: SortParams | null, filter?: FilterParams | null) => {
    return handleApiCall(async () => {
      const signal = requestManager.getSignal('payment-methods:list')
      
      const params: ListParams = { page, limit }
      if (sort) {
        params.sort = sort.field
        params.order = sort.order
      }
      if (filter) {
        Object.assign(params, filter)
      }
      
      try {
        // Note: Axios doesn't automatically unwrap nested data, so we access res.data directly
        // The backend returns: { success: true, message: "...", data: [...], pagination: {...} }
        const res = await api.get<BackendResponse<PaymentMethod[]>>('/payment-methods', { 
          params,
          signal
        })
        
        // Validate response structure
        if (!res.data || typeof res.data !== 'object') {
          throw new Error('Invalid response structure from server')
        }
        
        if (!res.data.success) {
          throw new Error(res.data.message || 'Failed to fetch payment methods')
        }
        
        if (!Array.isArray(res.data.data)) {
          throw new Error('Expected array of payment methods')
        }
        
        requestManager.cleanup('payment-methods:list')
        
        // Return in the format expected by the store
        return {
          data: res.data.data,
          pagination: res.data.pagination || {
            page,
            limit,
            total: res.data.data.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      } catch (error) {
        requestManager.cleanup('payment-methods:list')
        throw error
      }
    }, 'Failed to fetch payment methods', 'list')
  },

  getOptions: async () => {
    return handleApiCall(async () => {
      const res = await api.get<BackendResponse<PaymentMethodOption[]>>('/payment-methods/options')
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch payment method options')
      }
      return res.data.data
    }, 'Failed to fetch payment method options', 'getOptions')
  },

  getById: async (id: number) => {
    return handleApiCall(async () => {
      const res = await api.get<BackendResponse<PaymentMethod>>(`/payment-methods/${id}`)
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch payment method')
      }
      return res.data.data
    }, 'Failed to fetch payment method', 'getById')
  },

  create: async (data: CreatePaymentMethodDto) => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<PaymentMethod>>('/payment-methods', data)
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to create payment method')
      }
      return res.data.data
    }, 'Failed to create payment method', 'create')
  },

  update: async (id: number, data: UpdatePaymentMethodDto) => {
    return handleApiCall(async () => {
      const res = await api.put<BackendResponse<PaymentMethod>>(`/payment-methods/${id}`, data)
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to update payment method')
      }
      return res.data.data
    }, 'Failed to update payment method', 'update')
  },

  delete: async (id: number) => {
    return handleApiCall(async () => {
      await api.delete(`/payment-methods/${id}`)
    }, 'Failed to delete payment method', 'delete')
  },

  bulkUpdateStatus: async (ids: number[], is_active: boolean) => {
    return handleApiCall(async () => {
      await api.put('/payment-methods/bulk/status', { ids, is_active })
    }, 'Failed to update payment methods status', 'bulkUpdateStatus')
  },

  bulkDelete: async (ids: number[]) => {
    return handleApiCall(async () => {
      await api.delete('/payment-methods/bulk', { data: { ids } })
    }, 'Failed to delete payment methods', 'bulkDelete')
  }
}

