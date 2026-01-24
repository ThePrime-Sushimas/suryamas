/**
 * pos-aggregates.api.ts
 * 
 * API layer for pos-aggregates feature.
 * Handles all HTTP communication with the backend.
 * Features:
 * - Request cancellation with AbortController
 * - Comprehensive error handling with user-friendly messages
 * - Type-safe API responses
 * - Request deduplication
 */

import api from '@/lib/axios'
import type {
  AggregatedTransaction,
  AggregatedTransactionWithDetails,
  AggregatedTransactionListItem,
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionSummary,
  AggregatedTransactionBatchResult,
  BatchReconcileDto,
  BatchAssignJournalDto,
  GenerateJournalDto,
  JournalGenerationResult,
  PaymentMethodOption,
  ListParams,
} from '../types'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Backend response structure (matches backend sendSuccess format)
 */
interface BackendResponse<T> {
  success: boolean
  message?: string
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if error is a cancellation error (from AbortController)
 * These errors are expected during debouncing/HMR and should be silenced
 */
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
  if (
    err.message &&
    typeof err.message === 'string' &&
    (err.message.includes('canceled') || err.message.includes('cancelled'))
  ) {
    return true
  }

  return false
}

/**
 * Parse error message from various possible locations
 */
const parseErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'An unexpected error occurred'

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

  // Handle specific status codes
  if (statusCode === 401) {
    return 'Sesi telah berakhir, silakan login kembali'
  }
  if (statusCode === 403) {
    return 'Anda tidak memiliki akses ke fitur ini'
  }
  if (statusCode === 404) {
    return 'Data tidak ditemukan'
  }
  if (statusCode === 409) {
    return 'Data telah diubah oleh pengguna lain, silakan刷新'
  }
  if (statusCode === 422) {
    return 'Validasi data gagal, periksa input Anda'
  }
  if (statusCode === 500) {
    return 'Terjadi kesalahan server, silakan coba lagi'
  }

  // Try backend error messages
  if (backendError && typeof backendError === 'string' && backendError.trim()) {
    return backendError
  }
  if (backendMessage && typeof backendMessage === 'string' && !backendMessage.includes('Success')) {
    return backendMessage
  }
  if (axiosError.message) {
    return axiosError.message
  }

  return 'Operasi gagal, silakan coba lagi'
}

/**
 * Generic API call handler with error processing
 */
const handleApiCall = async <T>(
  apiCall: () => Promise<T>,
  errorMessage = 'Operation failed',
  context?: string
): Promise<T> => {
  try {
    return await apiCall()
  } catch (error: unknown) {
    // Handle cancellation errors gracefully
    if (isCanceledError(error)) {
      throw new Error('Request was canceled')
    }

    // Log full error details for debugging
    console.error(`[PosAggregates API] Error${context ? ` in ${context}` : ''}:`, {
      errorMessage,
      error,
      isAxiosError: error && typeof error === 'object' && 'isAxiosError' in error,
      hasResponse: error && typeof error === 'object' && 'response' in error,
    })

    const message = parseErrorMessage(error)
    throw new Error(message)
  }
}

// =============================================================================
// REQUEST MANAGER (for request cancellation)
// =============================================================================

/**
 * Request manager for handling abort controllers
 * Prevents race conditions and handles debouncing
 */
class RequestManager {
  private controllers = new Map<string, AbortController>()

  /**
   * Get a new abort signal for a request
   * Aborts any existing request with the same key
   */
  getSignal(key: string): AbortSignal {
    this.abort(key)
    const controller = new AbortController()
    this.controllers.set(key, controller)
    return controller.signal
  }

  /**
   * Abort existing request by key
   */
  abort(key: string) {
    const controller = this.controllers.get(key)
    if (controller) {
      controller.abort()
      this.controllers.delete(key)
    }
  }

  /**
   * Clean up request manager entry
   */
  cleanup(key: string) {
    this.controllers.delete(key)
  }

  /**
   * Abort all pending requests
   */
  abortAll() {
    for (const controller of this.controllers.values()) {
      controller.abort()
    }
    this.controllers.clear()
  }
}

const requestManager = new RequestManager()

// =============================================================================
// API CLIENT
// =============================================================================

export const posAggregatesApi = {
  /**
   * List aggregated transactions with pagination and filters
   */
  list: async (
    page = 1,
    limit = 25,
    sort?: AggregatedTransactionSortParams | null,
    filter?: AggregatedTransactionFilterParams | null
  ): Promise<{ data: AggregatedTransactionListItem[]; pagination: BackendResponse<AggregatedTransactionListItem[]>['pagination'] }> => {
    return handleApiCall(async () => {
      const signal = requestManager.getSignal('pos-aggregates:list')

      const params: ListParams = { page, limit }
      if (sort) {
        params.sort = sort.field
        params.order = sort.order
      }
      // Only add filter params if they have values (not undefined/null)
      if (filter) {
        if (filter.branch_name !== undefined && filter.branch_name !== null) {
          params.branch_name = filter.branch_name
        }
        // Handle branch_names (can be array or comma-separated string)
        if (filter.branch_names) {
          if (Array.isArray(filter.branch_names)) {
            params.branch_names = filter.branch_names.join(',')
          } else {
            params.branch_names = filter.branch_names
          }
        }
        if (filter.source_type) {
          params.source_type = filter.source_type
        }
        if (filter.source_id) {
          params.source_id = filter.source_id
        }
        if (filter.payment_method_id !== undefined && filter.payment_method_id !== null) {
          params.payment_method_id = filter.payment_method_id
        }
        // Handle payment_method_ids (can be array or comma-separated string)
        if (filter.payment_method_ids) {
          if (Array.isArray(filter.payment_method_ids)) {
            params.payment_method_ids = filter.payment_method_ids.join(',')
          } else {
            params.payment_method_ids = filter.payment_method_ids
          }
        }
        if (filter.transaction_date) {
          params.transaction_date = filter.transaction_date
        }
        if (filter.transaction_date_from) {
          params.transaction_date_from = filter.transaction_date_from
        }
        if (filter.transaction_date_to) {
          params.transaction_date_to = filter.transaction_date_to
        }
        if (filter.status) {
          params.status = filter.status
        }
        if (filter.is_reconciled !== undefined && filter.is_reconciled !== null) {
          params.is_reconciled = filter.is_reconciled
        }
        if (filter.has_journal !== undefined && filter.has_journal !== null) {
          params.has_journal = filter.has_journal
        }
        if (filter.search) {
          params.search = filter.search
        }
        if (filter.show_deleted) {
          params.show_deleted = filter.show_deleted
        }
      }

      try {
        const res = await api.get<BackendResponse<AggregatedTransactionListItem[]>>('/aggregated-transactions', {
          params,
          signal,
        })

        // Validate response structure
        if (!res.data || typeof res.data !== 'object') {
          throw new Error('Invalid response structure from server')
        }

        if (!res.data.success) {
          throw new Error(res.data.message || 'Failed to fetch aggregated transactions')
        }

        if (!Array.isArray(res.data.data)) {
          throw new Error('Expected array of aggregated transactions')
        }

        requestManager.cleanup('pos-aggregates:list')

        return {
          data: res.data.data,
          pagination: res.data.pagination || {
            page,
            limit,
            total: res.data.data.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }
      } catch (error) {
        requestManager.cleanup('pos-aggregates:list')
        throw error
      }
    }, 'Gagal mengambil data transaksi agregat', 'list')
  },

  /**
   * Get single aggregated transaction by ID
   */
  getById: async (id: string): Promise<AggregatedTransactionWithDetails> => {
    return handleApiCall(async () => {
      const res = await api.get<BackendResponse<AggregatedTransactionWithDetails>>(
        `/aggregated-transactions/${id}`
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch aggregated transaction')
      }

      if (!res.data.data) {
        throw new Error('Transaction not found')
      }

      return res.data.data
    }, 'Gagal mengambil detail transaksi agregat', 'getById')
  },

  /**
   * Create new aggregated transaction
   */
  create: async (data: CreateAggregatedTransactionDto): Promise<AggregatedTransaction> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<AggregatedTransaction>>('/aggregated-transactions', data)

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to create aggregated transaction')
      }

      if (!res.data.data) {
        throw new Error('No data returned after creation')
      }

      return res.data.data
    }, 'Gagal membuat transaksi agregat', 'create')
  },

  /**
   * Create batch of aggregated transactions
   */
  createBatch: async (
    transactions: CreateAggregatedTransactionDto[]
  ): Promise<AggregatedTransactionBatchResult> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<AggregatedTransactionBatchResult>>(
        '/aggregated-transactions/batch',
        { transactions }
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to create batch transactions')
      }

      return res.data.data
    }, 'Gagal membuat transaksi batch', 'createBatch')
  },

  /**
   * Update aggregated transaction
   */
  update: async (
    id: string,
    data: UpdateAggregatedTransactionDto
  ): Promise<AggregatedTransaction> => {
    return handleApiCall(async () => {
      const res = await api.put<BackendResponse<AggregatedTransaction>>(
        `/aggregated-transactions/${id}`,
        data
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to update aggregated transaction')
      }

      if (!res.data.data) {
        throw new Error('No data returned after update')
      }

      return res.data.data
    }, 'Gagal memperbarui transaksi agregat', 'update')
  },

  /**
   * Soft delete aggregated transaction
   */
  delete: async (id: string): Promise<void> => {
    return handleApiCall(async () => {
      const res = await api.delete<BackendResponse<void>>(`/aggregated-transactions/${id}`)

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to delete aggregated transaction')
      }
    }, 'Gagal menghapus transaksi agregat', 'delete')
  },

  /**
   * Restore soft-deleted transaction
   */
  restore: async (id: string): Promise<void> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<void>>(`/aggregated-transactions/${id}/restore`)

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to restore aggregated transaction')
      }
    }, 'Gagal memulihkan transaksi agregat', 'restore')
  },

  /**
   * Mark transaction as reconciled
   */
  reconcile: async (id: string, reconciledBy: string): Promise<void> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<void>>(`/aggregated-transactions/${id}/reconcile`, {
        reconciled_by: reconciledBy,
      })

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to reconcile transaction')
      }
    }, 'Gagal merekonsiliasi transaksi', 'reconcile')
  },

  /**
   * Batch reconcile transactions
   */
  batchReconcile: async (data: BatchReconcileDto): Promise<number> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<{ reconciled_count: number }>>(
        '/aggregated-transactions/batch/reconcile',
        data
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to batch reconcile transactions')
      }

      return res.data.data.reconciled_count
    }, 'Gagal merekonsiliasi transaksi secara batch', 'batchReconcile')
  },

  /**
   * Get summary statistics
   */
  getSummary: async (
    filter?: AggregatedTransactionFilterParams
  ): Promise<AggregatedTransactionSummary> => {
    return handleApiCall(async () => {
      const params: Record<string, unknown> = {}
      // Only add filter params if they have values (not undefined/null)
      if (filter) {
        if (filter.branch_name !== undefined && filter.branch_name !== null) {
          params.branch_name = filter.branch_name
        }
        // Handle branch_names (can be array or comma-separated string)
        if (filter.branch_names) {
          if (Array.isArray(filter.branch_names)) {
            params.branch_names = filter.branch_names.join(',')
          } else {
            params.branch_names = filter.branch_names
          }
        }
        if (filter.transaction_date_from) {
          params.transaction_date_from = filter.transaction_date_from
        }
        if (filter.transaction_date_to) {
          params.transaction_date_to = filter.transaction_date_to
        }
      }

      const res = await api.get<BackendResponse<AggregatedTransactionSummary>>(
        '/aggregated-transactions/summary',
        { params }
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch summary')
      }

      return res.data.data
    }, 'Gagal mengambil ringkasan', 'getSummary')
  },

  /**
   * Generate journal entries from eligible transactions
   */
  generateJournal: async (data: GenerateJournalDto): Promise<JournalGenerationResult[]> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<JournalGenerationResult[]>>(
        '/aggregated-transactions/generate-journal',
        data
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to generate journal')
      }

      return res.data.data || []
    }, 'Gagal membuat jurnal', 'generateJournal')
  },

  /**
   * Assign journal to transaction
   */
  assignJournal: async (id: string, journalId: string): Promise<void> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<void>>(
        `/aggregated-transactions/${id}/assign-journal`,
        { journal_id: journalId }
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to assign journal')
      }
    }, 'Gagal menetapkan jurnal', 'assignJournal')
  },

  /**
   * Batch assign journal to multiple transactions
   */
  batchAssignJournal: async (data: BatchAssignJournalDto): Promise<{ assigned: number; skipped: number }> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<{ assigned: number; skipped: number }>>(
        '/aggregated-transactions/batch/assign-journal',
        data
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to batch assign journal')
      }

      return res.data.data
    }, 'Gagal menetapkan jurnal secara batch', 'batchAssignJournal')
  },

  /**
   * Get unreconciled transactions for journal generation
   */
  getUnreconciled: async (
    filter: AggregatedTransactionFilterParams
  ): Promise<AggregatedTransactionListItem[]> => {
    return handleApiCall(async () => {
      const params: Record<string, unknown> = {}
      Object.assign(params, filter)

      const res = await api.get<BackendResponse<AggregatedTransactionListItem[]>>(
        '/aggregated-transactions/unreconciled',
        { params }
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch unreconciled transactions')
      }

      return res.data.data || []
    }, 'Gagal mengambil transaksi yang belum direkonsiliasi', 'getUnreconciled')
  },

  /**
   * Check if source already exists (for validation)
   */
  checkSourceExists: async (
    sourceType: string,
    sourceId: string,
    sourceRef: string
  ): Promise<boolean> => {
    return handleApiCall(async () => {
      const res = await api.get<BackendResponse<{ exists: boolean }>>(
        '/aggregated-transactions/check-source',
        {
          params: { source_type: sourceType, source_id: sourceId, source_ref: sourceRef },
        }
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to check source existence')
      }

      return res.data.data.exists
    }, 'Gagal memeriksa keberadaan sumber', 'checkSourceExists')
  },

  /**
   * Generate aggregated transactions from POS import lines
   */
  generateFromImport: async (
    importId: string,
    companyId: string,
    branchName?: string
  ): Promise<{ created: number; skipped: number; errors: Array<{ source_ref: string; error: string }> }> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<{
        created: number
        skipped: number
        errors: Array<{ source_ref: string; error: string }>
      }>>(`/aggregated-transactions/generate-from-import/${importId}`, {
        company_id: companyId,
        branch_name: branchName,
      })

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to generate from import')
      }

      return res.data.data
    }, 'Gagal membuat transaksi dari import', 'generateFromImport')
  },

  /**
   * Get payment method options for dropdowns
   */
  getPaymentMethodOptions: async (): Promise<PaymentMethodOption[]> => {
    return handleApiCall(async () => {
      const res = await api.get<BackendResponse<PaymentMethodOption[]>>('/payment-methods/options')

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch payment method options')
      }

      return res.data.data || []
    }, 'Gagal mengambil opsi metode pembayaran', 'getPaymentMethodOptions')
  },

  /**
   * List failed transactions with pagination and filters
   */
  listFailed: async (
    page = 1,
    limit = 25,
    sort?: AggregatedTransactionSortParams | null,
    filter?: AggregatedTransactionFilterParams | null
  ): Promise<{ data: AggregatedTransactionListItem[]; pagination: BackendResponse<AggregatedTransactionListItem[]>['pagination'] }> => {
    return handleApiCall(async () => {
      const signal = requestManager.getSignal('pos-aggregates:list-failed')

      const params: ListParams = { page, limit }
      if (sort) {
        params.sort = sort.field
        params.order = sort.order
      }
      if (filter) {
        if (filter.branch_name !== undefined && filter.branch_name !== null) {
          params.branch_name = filter.branch_name
        }
        // Handle branch_names (can be array or comma-separated string)
        if (filter.branch_names) {
          if (Array.isArray(filter.branch_names)) {
            params.branch_names = filter.branch_names.join(',')
          } else {
            params.branch_names = filter.branch_names
          }
        }
        if (filter.transaction_date_from) {
          params.transaction_date_from = filter.transaction_date_from
        }
        if (filter.transaction_date_to) {
          params.transaction_date_to = filter.transaction_date_to
        }
        if (filter.search) {
          params.search = filter.search
        }
      }

      try {
        const res = await api.get<BackendResponse<AggregatedTransactionListItem[]>>(
          '/aggregated-transactions/failed',
          { params, signal }
        )

        if (!res.data.success) {
          throw new Error(res.data.message || 'Failed to fetch failed transactions')
        }

        if (!Array.isArray(res.data.data)) {
          throw new Error('Expected array of failed transactions')
        }

        requestManager.cleanup('pos-aggregates:list-failed')

        return {
          data: res.data.data,
          pagination: res.data.pagination || {
            page,
            limit,
            total: res.data.data.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }
      } catch (error) {
        requestManager.cleanup('pos-aggregates:list-failed')
        throw error
      }
    }, 'Gagal mengambil data transaksi gagal', 'listFailed')
  },

  /**
   * Get failed transaction details by ID
   */
  getFailedById: async (id: string): Promise<AggregatedTransactionWithDetails> => {
    return handleApiCall(async () => {
      const res = await api.get<BackendResponse<AggregatedTransactionWithDetails>>(
        `/aggregated-transactions/failed/${id}`
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fetch failed transaction')
      }

      if (!res.data.data) {
        throw new Error('Failed transaction not found')
      }

      return res.data.data
    }, 'Gagal mengambil detail transaksi gagal', 'getFailedById')
  },

  /**
   * Fix and retry a failed transaction
   */
  fixFailed: async (
    id: string,
    updates?: UpdateAggregatedTransactionDto
  ): Promise<AggregatedTransaction> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<AggregatedTransaction>>(
        `/aggregated-transactions/failed/${id}/fix`,
        updates || {}
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to fix failed transaction')
      }

      if (!res.data.data) {
        throw new Error('No data returned after fix')
      }

      return res.data.data
    }, 'Gagal memperbaiki transaksi gagal', 'fixFailed')
  },

  /**
   * Batch fix multiple failed transactions
   */
  batchFixFailed: async (
    ids: string[],
    updates?: UpdateAggregatedTransactionDto
  ): Promise<{ fixed: string[]; failed: Array<{ id: string; error: string }> }> => {
    return handleApiCall(async () => {
      const res = await api.post<BackendResponse<{
        fixed: string[]
        failed: Array<{ id: string; error: string }>
      }>>('/aggregated-transactions/failed/batch-fix', {
        ids,
        updates: updates || {}
      })

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to batch fix failed transactions')
      }

      return res.data.data
    }, 'Gagal memperbaiki transaksi secara batch', 'batchFixFailed')
  },

  /**
   * Permanently delete a failed transaction
   */
  deleteFailed: async (id: string): Promise<void> => {
    return handleApiCall(async () => {
      const res = await api.delete<BackendResponse<void>>(
        `/aggregated-transactions/failed/${id}`
      )

      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to delete failed transaction')
      }
    }, 'Gagal menghapus transaksi gagal', 'deleteFailed')
  },

  /**
   * Cleanup all pending requests (call on unmount)
   */
  cleanup: () => {
    requestManager.abortAll()
  },
}

