/**
 * pos-aggregates.store.ts
 * 
 * Zustand store for pos-aggregates feature.
 * Single source of truth for all pos-aggregates state.
 * Features:
 * - Type-safe state management
 * - Proper loading/error states
 * - Pagination & filter state ownership
 * - Optimistic updates with rollback
 * - Persistence for filter/sort preferences
 * - Consistent error handling
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
import { createError } from '../utils/error'

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
  
  // Loading states - unified
  isLoading: boolean
  isMutating: boolean
  
  // Computed: unified loading state for initial data fetch
  isDataLoading: () => boolean
  
  // Error - typed
  error: ReturnType<typeof createError> | null
  
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

/**
 * Create typed error for store
 */
const createStoreError = createError

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

        // Computed: unified loading state
        isDataLoading: () => {
          const state = get()
          return state.isLoading
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
            set({ error: createStoreError(message, 'JOB_CREATE_ERROR'), isMutating: false })
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
            set({ error: createStoreError(message, 'JOB_CREATE_ERROR'), isMutating: false })
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
            if (isCanceledError(error) || (error instanceof Error && error.message === 'Request was canceled')) {
              set({ isLoading: false })
              return
            }
            
            const message = error instanceof Error ? error.message : 'Gagal mengambil data transaksi'
            console.error('[PosAggregatesStore] Error fetching transactions:', error)
            set({ 
              error: createStoreError(message, 'FETCH_LIST_ERROR', error), 
              isLoading: false 
            })
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
            set({ 
              error: createStoreError(message, 'FETCH_DETAIL_ERROR', error), 
              isLoading: false 
            })
            throw error
          }
        },

        fetchSummary: async () => {
          set({ isLoading: true, error: null })
          try {
            const { filter } = get()
            const summary = await posAggregatesApi.getSummary(filter)
            set({ summary, isLoading: false })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal mengambil ringkasan'
            set({ 
              error: createStoreError(message, 'FETCH_SUMMARY_ERROR', error), 
              isLoading: false 
            })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - CRUD (with rollback on error)
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
            set({ error: createStoreError(message, 'CREATE_ERROR', error), isMutating: false })
            throw error
          }
        },

        updateTransaction: async (id: string, data: UpdateAggregatedTransactionDto) => {
          // Store previous state for rollback
          const previousTransactions = get().transactions
          const previousSelected = get().selectedTransaction
          
          // Optimistic update
          set((state) => ({
            isMutating: true,
            error: null,
            transactions: state.transactions.map((tx) =>
              tx.id === id ? { ...tx, ...data } as AggregatedTransactionListItem : tx
            ),
            selectedTransaction: state.selectedTransaction?.id === id
              ? { ...state.selectedTransaction, ...data } as AggregatedTransactionWithDetails
              : state.selectedTransaction,
          }))
          
          try {
            const transaction = await posAggregatesApi.update(id, data)
            set((state) => ({
              transactions: state.transactions.map((tx) =>
                tx.id === id ? { ...tx, ...transaction } as AggregatedTransactionListItem : tx
              ),
              selectedTransaction: state.selectedTransaction?.id === id
                ? { ...state.selectedTransaction, ...transaction } as AggregatedTransactionWithDetails
                : state.selectedTransaction,
              isMutating: false,
            }))
            return transaction
          } catch (error) {
            // Rollback on error
            set({
              transactions: previousTransactions,
              selectedTransaction: previousSelected,
              error: createStoreError(
                error instanceof Error ? error.message : 'Gagal memperbarui transaksi',
                'UPDATE_ERROR',
                error
              ),
              isMutating: false,
            })
            throw error
          }
        },

        deleteTransaction: async (id: string) => {
          // Store previous state for rollback
          const previousTransactions = get().transactions
          const previousTotal = get().total
          const previousSelected = get().selectedTransaction
          
          // Optimistic update
          set((state) => ({
            isMutating: true,
            error: null,
            transactions: state.transactions.filter((tx) => tx.id !== id),
            total: state.total - 1,
            selectedTransaction: state.selectedTransaction?.id === id ? null : state.selectedTransaction,
          }))
          
          try {
            await posAggregatesApi.delete(id)
            set({ isMutating: false })
          } catch (error) {
            // Rollback on error
            set({
              transactions: previousTransactions,
              total: previousTotal,
              selectedTransaction: previousSelected,
              error: createStoreError(
                error instanceof Error ? error.message : 'Gagal menghapus transaksi',
                'DELETE_ERROR',
                error
              ),
              isMutating: false,
            })
            throw error
          }
        },

        restoreTransaction: async (id: string) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.restore(id)
            await get().fetchTransactions()
            set({ isMutating: false })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal memulihkan transaksi'
            set({ error: createStoreError(message, 'RESTORE_ERROR', error), isMutating: false })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - Reconciliation (with rollback on error)
        // --------------------------------------------------------------------
        
        reconcileTransaction: async (id: string, reconciledBy: string) => {
          // Store previous state for rollback
          const previousTransactions = get().transactions
          
          // Optimistic update
          set((state) => ({
            isMutating: true,
            error: null,
            transactions: state.transactions.map((tx) =>
              tx.id === id ? { ...tx, is_reconciled: true } as AggregatedTransactionListItem : tx
            ),
          }))
          
          try {
            await posAggregatesApi.reconcile(id, reconciledBy)
            set({ isMutating: false })
          } catch (error) {
            // Rollback on error
            set({
              transactions: previousTransactions,
              error: createStoreError(
                error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi',
                'RECONCILE_ERROR',
                error
              ),
              isMutating: false,
            })
            throw error
          }
        },

        batchReconcile: async (ids: string[], reconciledBy: string) => {
          // Store previous state for rollback
          const previousTransactions = get().transactions
          
          // Optimistic update
          set((state) => ({
            isMutating: true,
            error: null,
            transactions: state.transactions.map((tx) =>
              ids.includes(tx.id) ? { ...tx, is_reconciled: true } as AggregatedTransactionListItem : tx
            ),
            selectedIds: new Set<string>(),
          }))
          
          try {
            const count = await posAggregatesApi.batchReconcile({ 
              transaction_ids: ids, 
              reconciled_by: reconciledBy 
            })
            // Refresh data from server to ensure consistency
            await get().fetchTransactions()
            await get().fetchSummary()
            set({ isMutating: false })
            return count
          } catch (error) {
            // Rollback on error
            set({
              transactions: previousTransactions,
              error: createStoreError(
                error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi secara batch',
                'BATCH_RECONCILE_ERROR',
                error
              ),
              isMutating: false,
            })
            throw error
          }
        },

        // --------------------------------------------------------------------
        // Actions - Journal (with rollback on error)
        // --------------------------------------------------------------------
        
        generateJournal: async (data: Parameters<typeof posAggregatesApi.generateJournal>[0]) => {
          set({ isMutating: true, error: null })
          try {
            await posAggregatesApi.generateJournal(data)
            await get().fetchTransactions()
            await get().fetchSummary()
            set({ isMutating: false })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal membuat jurnal'
            set({ error: createStoreError(message, 'GENERATE_JOURNAL_ERROR', error), isMutating: false })
            throw error
          }
        },

        assignJournal: async (id: string, journalId: string) => {
          // Store previous state for rollback
          const previousTransactions = get().transactions
          
          // Optimistic update
          set((state) => ({
            isMutating: true,
            error: null,
            transactions: state.transactions.map((tx) =>
              tx.id === id ? { ...tx, journal_id: journalId } as AggregatedTransactionListItem : tx
            ),
          }))
          
          try {
            await posAggregatesApi.assignJournal(id, journalId)
            set({ isMutating: false })
          } catch (error) {
            // Rollback on error
            set({
              transactions: previousTransactions,
              error: createStoreError(
                error instanceof Error ? error.message : 'Gagal menetapkan jurnal',
                'ASSIGN_JOURNAL_ERROR',
                error
              ),
              isMutating: false,
            })
            throw error
          }
        },

        batchAssignJournal: async (ids: string[], journalId: string) => {
          // Store previous state for rollback
          const previousTransactions = get().transactions
          
          // Optimistic update
          set((state) => ({
            isMutating: true,
            error: null,
            transactions: state.transactions.map((tx) =>
              ids.includes(tx.id) ? { ...tx, journal_id: journalId } as AggregatedTransactionListItem : tx
            ),
            selectedIds: new Set<string>(),
          }))
          
          try {
            const result = await posAggregatesApi.batchAssignJournal({
              transaction_ids: ids,
              journal_id: journalId,
            })
            await get().fetchTransactions()
            set({ isMutating: false })
            return result
          } catch (error) {
            // Rollback on error
            set({
              transactions: previousTransactions,
              error: createStoreError(
                error instanceof Error ? error.message : 'Gagal menetapkan jurnal secara batch',
                'BATCH_ASSIGN_JOURNAL_ERROR',
                error
              ),
              isMutating: false,
            })
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
        },

        clearFilter: () => {
          set({ filter: initialFilter, page: 1 })
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

