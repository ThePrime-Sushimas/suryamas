import { create } from 'zustand'
import { posAggregatesApi } from '../api/posAggregates.api'
import type { 
  AggregatedTransactionListItem, 
  AggregatedTransactionWithDetails,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  UpdateAggregatedTransactionDto
} from '../types'

interface FailedTransactionsState {
  // Data
  transactions: AggregatedTransactionListItem[]
  selectedTransaction: AggregatedTransactionWithDetails | null
  selectedIds: Set<string>
  
  // Pagination
  page: number
  limit: number
  total: number
  totalPages: number
  
  // Loading states
  isLoading: boolean
  isMutating: boolean
  
  // Filters
  filter: AggregatedTransactionFilterParams
  sort: AggregatedTransactionSortParams | null
  
  // Actions
  fetchTransactions: () => Promise<void>
  fetchTransactionById: (id: string) => Promise<AggregatedTransactionWithDetails>
  fixTransaction: (id: string, updates?: UpdateAggregatedTransactionDto) => Promise<void>
  batchFixTransactions: (ids: string[], updates?: UpdateAggregatedTransactionDto) => Promise<{
    fixed: string[]
    failed: Array<{ id: string; error: string }>
  }>
  deleteTransaction: (id: string) => Promise<void>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilter: (filter: AggregatedTransactionFilterParams) => void
  setSort: (sort: AggregatedTransactionSortParams | null) => void
  toggleSelection: (id: string) => void
  toggleAllSelection: () => void
  clearSelection: () => void
  setSelectedTransaction: (tx: AggregatedTransactionWithDetails | null) => void
}

export const useFailedTransactionsStore = create<FailedTransactionsState>((set, get) => ({
  // Initial state
  transactions: [],
  selectedTransaction: null,
  selectedIds: new Set(),
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  isLoading: false,
  isMutating: false,
  filter: {},
  sort: { field: 'created_at' as const, order: 'desc' as const },
  
  // Fetch failed transactions
  fetchTransactions: async () => {
    const { page, limit, filter, sort } = get()
    set({ isLoading: true })
    
    try {
      const result = await posAggregatesApi.listFailed(page, limit, sort, {
        ...filter,
        status: 'FAILED' as const
      })
      
      set({
        transactions: result.data,
        total: result.pagination?.total || 0,
        totalPages: result.pagination?.totalPages || 1,
        isLoading: false
      })
    } catch (error: unknown) {
      // Check if it's a cancellation error - these are expected and should be silently ignored
      const isCanceled = 
        error instanceof Error && 
        (error.message === 'Request was canceled' || 
         error.message.includes('canceled') || 
         error.message.includes('cancelled'))
      
      // Only set error state if it's NOT a cancellation error
      if (!isCanceled) {
        console.error('Failed to fetch failed transactions:', error)
      }
      set({ isLoading: false })
      // Don't throw the error for cancellation - it's expected behavior
      if (isCanceled) {
        return
      }
      throw error
    }
  },
  
  // Fetch single failed transaction with details
  fetchTransactionById: async (id: string) => {
    set({ isLoading: true })
    
    try {
      const transaction = await posAggregatesApi.getFailedById(id)
      set({ 
        selectedTransaction: transaction,
        isLoading: false 
      })
      return transaction
    } catch (error) {
      console.error('Failed to fetch failed transaction:', error)
      set({ isLoading: false })
      throw error
    }
  },
  
  // Fix and retry a failed transaction
  fixTransaction: async (id: string, updates?: UpdateAggregatedTransactionDto) => {
    set({ isMutating: true })
    
    try {
      await posAggregatesApi.fixFailed(id, updates)
      
      // Remove from list and refresh
      set((state) => ({
        transactions: state.transactions.filter(tx => tx.id !== id),
        total: state.total - 1,
        selectedTransaction: null,
        isMutating: false
      }))
    } catch (error) {
      set({ isMutating: false })
      throw error
    }
  },
  
  // Batch fix failed transactions
  batchFixTransactions: async (ids: string[], updates?: UpdateAggregatedTransactionDto) => {
    set({ isMutating: true })
    
    try {
      const result = await posAggregatesApi.batchFixFailed(ids, updates)
      
      // Remove fixed transactions from list
      set((state) => ({
        transactions: state.transactions.filter(tx => !result.fixed.includes(tx.id)),
        total: state.total - result.fixed.length,
        selectedIds: new Set(),
        isMutating: false
      }))
      
      return result
    } catch (error) {
      set({ isMutating: false })
      throw error
    }
  },
  
  // Delete failed transaction permanently
  deleteTransaction: async (id: string) => {
    set({ isMutating: true })
    
    try {
      await posAggregatesApi.deleteFailed(id)
      
      // Remove from list
      set((state) => ({
        transactions: state.transactions.filter(tx => tx.id !== id),
        total: state.total - 1,
        selectedIds: new Set(state.selectedIds),
        isMutating: false
      }))
    } catch (error) {
      set({ isMutating: false })
      throw error
    }
  },
  
  // Pagination
  setPage: (page: number) => {
    set({ page })
    get().fetchTransactions()
  },
  
  setLimit: (limit: number) => {
    set({ limit, page: 1 })
    get().fetchTransactions()
  },
  
  // Filters
  setFilter: (filter: AggregatedTransactionFilterParams) => {
    set({ filter, page: 1 })
    get().fetchTransactions()
  },
  
  // Sort
  setSort: (sort: AggregatedTransactionSortParams | null) => {
    set({ sort })
    get().fetchTransactions()
  },
  
  // Selection
  toggleSelection: (id: string) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
      return { selectedIds: newSelected }
    })
  },
  
  toggleAllSelection: () => {
    const { transactions, selectedIds } = get()
    if (selectedIds.size === transactions.length) {
      set({ selectedIds: new Set() })
    } else {
      set({ selectedIds: new Set(transactions.map(tx => tx.id)) })
    }
  },
  
  clearSelection: () => {
    set({ selectedIds: new Set() })
  },
  
  setSelectedTransaction: (tx: AggregatedTransactionWithDetails | null) => {
    set({ selectedTransaction: tx })
  }
}))

export default useFailedTransactionsStore

