/**
 * pos-aggregates.store.ts
 * 
 * Zustand store for pos-aggregates feature.
 * Single source of truth for all pos-aggregates state.
 * Features:
 * - Type-safe state management
 * - Proper loading/error states
 * - Pagination & filter state ownership
 * - Optimistic updates
 * - Persistence for filter/sort preferences
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {
  AggregatedTransaction,
  AggregatedTransactionWithDetails,
  AggregatedTransactionListItem,
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionSummary,
  GenerateJournalDto,
} from '../types'
import { posAggregatesApi } from '../api/posAggregates.api'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Store state interface
 */
interface PosAggregatesState {
  // Data
  transactions: AggregatedTransactionListItem[]
  selectedTransaction: AggregatedTransactionWithDetails | null
  summary: AggregatedTransactionSummary | null
  
  // Pagination
  page: number
  limit: number
  total: number
  totalPages: number
  
  // Filter & Sort
  filter: AggregatedTransactionFilterParams
  sort: AggregatedTransactionSortParams | null
  
  // Selection (for bulk operations)
  selectedIds: Set<string>
  
  // Loading states
  isLoading: boolean
  isMutating: boolean
  isSummaryLoading: boolean
  
  // Computed: unified loading state for initial data fetch
  // Returns true when either table or summary is loading
  isDataLoading: () => boolean
  
  // Error
  error: string | null
  
  // Actions - Data Fetching
  fetchTransactions: (page?: number, limit?: number) => Promise<void>
  fetchTransactionById: (id: string) => Promise<AggregatedTransactionWithDetails>
  fetchSummary: () => Promise<void>
  
  // Actions - Jobs System
  generateFromImportWithJob: (importId: string, companyId: string, branchName?: string) => Promise<string>
  generateJournalWithJob: (data: GenerateJournalDto) => Promise<string>
  
  // Actions - CRUD
  createTransaction: (data: CreateAggregatedTransactionDto) => Promise<AggregatedTransaction>
  updateTransaction: (id: string, data: UpdateAggregatedTransactionDto) => Promise<AggregatedTransaction>
  deleteTransaction: (id: string) => Promise<void>
  restoreTransaction: (id: string) => Promise<void>
  
  // Actions - Reconciliation
  reconcileTransaction: (id: string, reconciledBy: string) => Promise<void>
  batchReconcile: (ids: string[], reconciledBy: string) => Promise<number>
  
  // Actions - Journal
  generateJournal: (data: Parameters<typeof posAggregatesApi.generateJournal>[0]) => Promise<void>
  assignJournal: (id: string, journalId: string) => Promise<void>
  batchAssignJournal: (ids: string[], journalId: string) => Promise<{ assigned: number; skipped: number }>
  
  // Actions - Selection
  toggleSelection: (id: string) => void
  toggleAllSelection: () => void
  selectAll: () => void
  clearSelection: () => void
  setSelectedIds: (ids: string[]) => void
  
  // Actions - Filter & Sort
  setFilter: (filter: Partial<AggregatedTransactionFilterParams>) => void
  clearFilter: () => void
  setSort: (sort: AggregatedTransactionSortParams | null) => void
  
  // Actions - Pagination
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  
  // Actions - UI State
  clearSelectionAndError: () => void
  clearError: () => void
}

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Initial filter state
 */
const initialFilter: AggregatedTransactionFilterParams = {
  branch_name: undefined,
  branch_names: undefined,
  source_type: undefined,
  source_id: undefined,
  payment_method_id: undefined,
  payment_method_ids: undefined,
  transaction_date: undefined,
  transaction_date_from: undefined,
  transaction_date_to: undefined,
  status: undefined,
  is_reconciled: undefined,
  has_journal: undefined,
  search: undefined,
  show_deleted: false,
}

/**
 * Initial sort state
 */
const initialSort: AggregatedTransactionSortParams = {
  field: 'transaction_date',
  order: 'desc',
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if error is a cancellation error (from AbortController)
 * These are expected during debouncing/HMR and should be silenced
 */
const isCanceledError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  
  const err = error as { code?: string; name?: string; message?: string }
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return true
  if (err.message && (err.message.includes('canceled') || err.message.includes('cancelled'))) return true
  return false
}

/**
 * Check if all transactions are selected
 */
const areAllSelected = (
  transactions: AggregatedTransactionListItem[],
  selectedIds: Set<string>
): boolean => {
  if (transactions.length === 0) return false
  return transactions.every((tx) => selectedIds.has(tx.id))
}

// =============================================================================
// STORE
// =============================================================================

export const usePosAggregatesStore = create<PosAggregatesState>()(
  devtools(
    persist(
      (set, get) => ({
        // --------------------------------------------------------------------
        // Initial State
        // --------------------------------------------------------------------
        transactions: [],
        selectedTransaction: null,
        summary: null,
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
        filter: initialFilter,
        sort: initialSort,
        selectedIds: new Set<string>(),
        isLoading: false,
        isMutating: false,
        isSummaryLoading: false,

        // Computed: unified loading state for initial data fetch
        // Returns true when either table or summary is loading
        isDataLoading: () => {
          const state = get()
          return state.isLoading || state.isSummaryLoading
        },

        error: null,

        // --------------------------------------------------------------------
        // Actions - Jobs System
        // --------------------------------------------------------------------
        
        generateFromImportWithJob: async (importId: string, companyId: string, branchName?: string) => {
          set({ isMutating: true, error: null })
          try {
            const { job_id } = await posAggregatesApi.generateFromImportWithJob(importId, companyId, branchName)
            set({ isMutating: false })
            return job_id
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal membuat job'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        generateJournalWithJob: async (data: GenerateJournalDto) => {
          set({ isMutating: true, error: null })
          try {
            const { job_id } = await posAggregatesApi.generateJournalWithJob(data)
            set({ isMutating: false })
            return job_id
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal membuat job'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - Data Fetching
        // --------------------------------------------------------------------
        
        fetchTransactions: async (page = 1, limit = 25) => {
          set({ isLoading: true, error: null })
          try {
            const { filter, sort } = get()
            const response = await posAggregatesApi.list(page, limit, sort, filter)
            const pagination = response.pagination
            
            set({
              transactions: response.data,
              page: pagination?.page ?? page,
              limit: pagination?.limit ?? limit,
              total: pagination?.total ?? response.data.length,
              totalPages: pagination?.totalPages ?? 1,
              isLoading: false,
            })
          } catch (error) {
            // Treat canceled requests as non-errors
            if (isCanceledError(error) || (error instanceof Error && error.message === 'Request was canceled')) {
              set({ isLoading: false })
              return
            }
            
            const message = error instanceof Error ? error.message : 'Gagal mengambil data transaksi'
            console.error('[PosAggregatesStore] Error fetching transactions:', error)
            set({ error: message, isLoading: false })
            throw error
          }
        },

        fetchTransactionById: async (id: string) => {
          set({ isLoading: true, error: null })
          try {
            const transaction = await posAggregatesApi.getById(id)
            set({ selectedTransaction: transaction, isLoading: false })
            return transaction
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal mengambil detail transaksi'
            set({ error: message, isLoading: false })
            throw error
          }
        },

        fetchSummary: async () => {
          set({ isSummaryLoading: true, error: null })
          try {
            const { filter } = get()
            const summary = await posAggregatesApi.getSummary(filter)
            set({ summary, isSummaryLoading: false })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal mengambil ringkasan'
            set({ error: message, isSummaryLoading: false })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - CRUD
        // --------------------------------------------------------------------
        
        createTransaction: async (data: CreateAggregatedTransactionDto) => {
          set({ isMutating: true, error: null })
          try {
            const transaction = await posAggregatesApi.create(data)
            set((state) => ({
              transactions: [transaction, ...state.transactions],
              total: state.total + 1,
              isMutating: false,
            }))
            return transaction
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal membuat transaksi'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        updateTransaction: async (id: string, data: UpdateAggregatedTransactionDto) => {
          set({ isMutating: true, error: null })
          try {
            const transaction = await posAggregatesApi.update(id, data)
            set((state) => ({
              transactions: state.transactions.map((tx) =>
                tx.id === id ? { ...tx, ...transaction } : tx
              ),
              selectedTransaction:
                state.selectedTransaction?.id === id
                  ? { ...state.selectedTransaction, ...transaction }
                  : state.selectedTransaction,
              isMutating: false,
            }))
            return transaction
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal memperbarui transaksi'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        deleteTransaction: async (id: string) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.delete(id)
            set((state) => ({
              transactions: state.transactions.filter((tx) => tx.id !== id),
              total: state.total - 1,
              selectedTransaction:
                state.selectedTransaction?.id === id ? null : state.selectedTransaction,
              isMutating: false,
            }))
          } catch (error) {
            // Refresh transactions to sync with backend state when delete fails
            await get().fetchTransactions()
            const message = error instanceof Error ? error.message : 'Gagal menghapus transaksi'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        restoreTransaction: async (id: string) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.restore(id)
            // Refresh the list to show restored item
            await get().fetchTransactions()
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal memulihkan transaksi'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - Reconciliation
        // --------------------------------------------------------------------
        
        reconcileTransaction: async (id: string, reconciledBy: string) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.reconcile(id, reconciledBy)
            set((state) => ({
              transactions: state.transactions.map((tx) =>
                tx.id === id ? { ...tx, is_reconciled: true } : tx
              ),
              isMutating: false,
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        batchReconcile: async (ids: string[], reconciledBy: string) => {
          set({ isMutating: true, error: null })
          try {
            const count = await posAggregatesApi.batchReconcile({ transaction_ids: ids, reconciled_by: reconciledBy })
            // Optimistic update: mark transactions as reconciled
            set((state) => ({
              transactions: state.transactions.map((tx) =>
                ids.includes(tx.id) ? { ...tx, is_reconciled: true } : tx
              ),
              selectedIds: new Set<string>(),
              isMutating: false,
            }))
            // Refresh data from server to ensure consistency
            await get().fetchTransactions()
            await get().fetchSummary()
            return count
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi secara batch'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - Journal
        // --------------------------------------------------------------------
        
        generateJournal: async (data: Parameters<typeof posAggregatesApi.generateJournal>[0]) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.generateJournal(data)
            // Refresh list after journal generation
            await get().fetchTransactions()
            await get().fetchSummary()
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal membuat jurnal'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        assignJournal: async (id: string, journalId: string) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.assignJournal(id, journalId)
            set((state) => ({
              transactions: state.transactions.map((tx) =>
                tx.id === id ? { ...tx, journal_number: journalId } : tx
              ),
              isMutating: false,
            }))
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal menetapkan jurnal'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        batchAssignJournal: async (ids: string[], journalId: string) => {
          set({ isMutating: true, error: null })
          try {
            const result = await posAggregatesApi.batchAssignJournal({
              transaction_ids: ids,
              journal_id: journalId,
            })
            // Refresh list after batch assign
            await get().fetchTransactions()
            set({
              selectedIds: new Set<string>(),
              isMutating: false,
            })
            return result
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal menetapkan jurnal secara batch'
            set({ error: message, isMutating: false })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - Selection
        // --------------------------------------------------------------------
        
        toggleSelection: (id: string) => {
          set((state) => {
            const newSelectedIds = new Set(state.selectedIds)
            if (newSelectedIds.has(id)) {
              newSelectedIds.delete(id)
            } else {
              newSelectedIds.add(id)
            }
            return { selectedIds: newSelectedIds }
          })
        },

        toggleAllSelection: () => {
          const { transactions, selectedIds } = get()
          const allSelected = areAllSelected(transactions, selectedIds)
          
          if (allSelected) {
            set({ selectedIds: new Set<string>() })
          } else {
            set({ selectedIds: new Set(transactions.map((tx) => tx.id)) })
          }
        },

        selectAll: () => {
          const { transactions } = get()
          set({ selectedIds: new Set(transactions.map((tx) => tx.id)) })
        },

        clearSelection: () => {
          set({ selectedIds: new Set<string>() })
        },

        setSelectedIds: (ids: string[]) => {
          set({ selectedIds: new Set(ids) })
        },

        // --------------------------------------------------------------------
        // Actions - Filter & Sort
        // --------------------------------------------------------------------
        
        setFilter: (filter: Partial<AggregatedTransactionFilterParams>) => {
          set((_state) => ({
            filter: { ..._state.filter, ...filter },
            page: 1,
          }))
          // NOTE: Do NOT auto-fetch here - fetch only happens when user clicks "Terapkan Filter"
        },

        clearFilter: () => {
          set({ filter: initialFilter, page: 1 })
          // NOTE: Do NOT auto-fetch here - fetch only happens when user clicks "Terapkan Filter"
        },

        setSort: (sort: AggregatedTransactionSortParams | null) => {
          set({ sort })
          get().fetchTransactions()
        },

        // --------------------------------------------------------------------
        // Actions - Pagination
        // --------------------------------------------------------------------
        
        setPage: (page: number) => {
          set({ page })
          get().fetchTransactions(page)
        },

        setLimit: (limit: number) => {
          set({ limit, page: 1 })
          get().fetchTransactions(1, limit)
        },

        // --------------------------------------------------------------------
        // Actions - UI State
        // --------------------------------------------------------------------
        
        clearSelectionAndError: () => {
          set({ selectedIds: new Set<string>(), error: null })
        },

        clearError: () => {
          set({ error: null })
        },
      }),
      {
        // Persistence configuration
        name: 'pos-aggregates-storage',
        partialize: (state) => ({
          filter: state.filter,
          sort: state.sort,
          limit: state.limit,
        }),
      }
    ),
    { name: 'pos-aggregates-store' }
  )
)

