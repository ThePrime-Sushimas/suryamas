import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { PaymentMethod, CreatePaymentMethodDto, UpdatePaymentMethodDto, FilterParams, SortParams } from '../types'
import { paymentMethodsApi } from '../api/paymentMethods.api'

interface PaymentMethodsState {
  // Data
  paymentMethods: PaymentMethod[]
  selectedPaymentMethod: PaymentMethod | null
  
  // Pagination
  page: number
  limit: number
  total: number
  totalPages: number
  
  // Filter & Sort
  filter: FilterParams
  sort: SortParams | null
  
  // Loading states
  isLoading: boolean
  isMutating: boolean
  
  // Error
  error: string | null
  
  // Actions
  fetchPaymentMethods: (page?: number, limit?: number) => Promise<void>
  fetchPaymentMethodById: (id: number) => Promise<PaymentMethod>
  createPaymentMethod: (data: CreatePaymentMethodDto) => Promise<PaymentMethod>
  updatePaymentMethod: (id: number, data: UpdatePaymentMethodDto) => Promise<PaymentMethod>
  deletePaymentMethod: (id: number) => Promise<void>
  bulkUpdateStatus: (ids: number[], is_active: boolean) => Promise<void>
  bulkDelete: (ids: number[]) => Promise<void>
  setFilter: (filter: Partial<FilterParams>) => void
  clearFilter: () => void
  setSort: (sort: SortParams | null) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  clearSelection: () => void
  clearError: () => void
}

const initialFilter: FilterParams = {
  payment_type: undefined,
  is_active: undefined,
  requires_bank_account: undefined,
  q: undefined
}

const initialSort: SortParams = {
  field: 'sort_order',
  order: 'asc'
}

// Helper to detect cancellation errors (Axios/AbortController)
const isCanceledError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; name?: string; message?: string }
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return true
  if (err.message && (err.message.includes('canceled') || err.message.includes('cancelled'))) return true
  return false
}

export const usePaymentMethodsStore = create<PaymentMethodsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        paymentMethods: [],
        selectedPaymentMethod: null,
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        filter: initialFilter,
        sort: initialSort,
        isLoading: false,
        isMutating: false,
        error: null,

        // Actions
        fetchPaymentMethods: async (page = 1, limit = 25) => {
          set({ isLoading: true, error: null })
          try {
            const { filter, sort } = get()
                        const response = await paymentMethodsApi.list(page, limit, sort, filter)
                        set({
              paymentMethods: response.data,
              page: response.pagination.page,
              limit: response.pagination.limit,
              total: response.pagination.total,
              totalPages: response.pagination.totalPages,
              isLoading: false
            })
          } catch (error) {
            // Treat canceled requests as non-errors to avoid noisy logs and unhandled rejections during HMR/debouncing
            if (isCanceledError(error) || (error instanceof Error && error.message === 'Request was canceled')) {
                            set({ isLoading: false })
              return
            }
            const message = error instanceof Error ? error.message : 'Failed to fetch payment methods'
            console.error('[PaymentMethodsStore] Error fetching payment methods:', error)
            set({ error: message, isLoading: false })
            throw error
          }
        },

        fetchPaymentMethodById: async (id: number) => {
          set({ isLoading: true, error: null })
          try {
            const paymentMethod = await paymentMethodsApi.getById(id)
            set({ selectedPaymentMethod: paymentMethod, isLoading: false })
            return paymentMethod
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch payment method'
            set({ error: message, isLoading: false })
            throw error
          }
        },

        createPaymentMethod: async (data: CreatePaymentMethodDto) => {
          set({ isMutating: true, error: null })
          try {
            const paymentMethod = await paymentMethodsApi.create(data)
            set((state) => ({
              paymentMethods: [paymentMethod, ...state.paymentMethods],
              total: state.total + 1,
              isMutating: false
            }))
            return paymentMethod
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create payment method'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        updatePaymentMethod: async (id: number, data: UpdatePaymentMethodDto) => {
          set({ isMutating: true, error: null })
          try {
            const paymentMethod = await paymentMethodsApi.update(id, data)
            set((state) => ({
              paymentMethods: state.paymentMethods.map((pm) =>
                pm.id === id ? paymentMethod : pm
              ),
              selectedPaymentMethod:
                state.selectedPaymentMethod?.id === id
                  ? paymentMethod
                  : state.selectedPaymentMethod,
              isMutating: false
            }))
            return paymentMethod
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update payment method'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        deletePaymentMethod: async (id: number) => {
          set({ isMutating: true, error: null })
          try {
            await paymentMethodsApi.delete(id)
            set((state) => ({
              paymentMethods: state.paymentMethods.filter((pm) => pm.id !== id),
              total: state.total - 1,
              selectedPaymentMethod:
                state.selectedPaymentMethod?.id === id ? null : state.selectedPaymentMethod,
              isMutating: false
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete payment method'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        bulkUpdateStatus: async (ids: number[], is_active: boolean) => {
          set({ isMutating: true, error: null })
          try {
            await paymentMethodsApi.bulkUpdateStatus(ids, is_active)
            set((state) => ({
              paymentMethods: state.paymentMethods.map((pm) =>
                ids.includes(pm.id) ? { ...pm, is_active } : pm
              ),
              isMutating: false
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update payment methods'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        bulkDelete: async (ids: number[]) => {
          set({ isMutating: true, error: null })
          try {
            await paymentMethodsApi.bulkDelete(ids)
            set((state) => ({
              paymentMethods: state.paymentMethods.filter((pm) => !ids.includes(pm.id)),
              total: state.total - ids.length,
              isMutating: false
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete payment methods'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        setFilter: (filter: Partial<FilterParams>) => {
          set((state) => ({
            filter: { ...state.filter, ...filter },
            page: 1
          }))
          get().fetchPaymentMethods(1)
        },

        clearFilter: () => {
          set({ filter: initialFilter, page: 1 })
          get().fetchPaymentMethods(1)
        },

        setSort: (sort: SortParams | null) => {
          set({ sort })
          get().fetchPaymentMethods()
        },

        setPage: (page: number) => {
          set({ page })
        },

        setLimit: (limit: number) => {
          set({ limit, page: 1 })
        },

        clearSelection: () => {
          set({ selectedPaymentMethod: null })
        },

        clearError: () => {
          set({ error: null })
        }
      }),
      {
        name: 'payment-methods-storage',
        partialize: (state) => ({
          filter: state.filter,
          sort: state.sort,
          limit: state.limit
        })
      }
    ),
    { name: 'payment-methods-store' }
  )
)
