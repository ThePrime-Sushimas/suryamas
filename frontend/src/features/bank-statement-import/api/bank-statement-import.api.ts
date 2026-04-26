import api from '@/lib/axios'
import type {
  BankStatementImport,
  BankStatementAnalysisResult,
  BankStatementImportFilters,
  BankStatementPreviewRow,
} from '../types/bank-statement-import.types'

// List response structure from backend - consistent pagination structure
interface PaginatedImportResponse {
  data: BankStatementImport[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export const bankStatementImportApi = {
  async list(params: { page?: number; limit?: number } & BankStatementImportFilters = {}): Promise<PaginatedImportResponse> {
    const response = await api.get('/bank-statement-imports', {
      params,
    })
    // Backend returns: { success: true, data: { data: [...], total, page, limit, ... } }
    return response.data.data
  },

  async upload(
    file: File,
    bankAccountId: string,
    onUploadProgress?: (progress: number) => void
  ): Promise<BankStatementAnalysisResult> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bank_account_id', bankAccountId)

    const response = await api.post('/bank-statement-imports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!event.total || !onUploadProgress) return
        const percent = Math.round((event.loaded * 100) / event.total)
        onUploadProgress(percent)
      },
    })

    return response.data.data
  },

  async confirm(id: number, payload: { skip_duplicates: boolean }): Promise<{ job_id: string }> {
    const response = await api.post(`/bank-statement-imports/${id}/confirm`, payload)
    return response.data.data
  },

  async cancel(id: number): Promise<void> {
    await api.post(`/bank-statement-imports/${id}/cancel`)
  },

  async retry(id: number): Promise<{ job_id: string }> {
    const response = await api.post(`/bank-statement-imports/${id}/retry`)
    return response.data.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/bank-statement-imports/${id}`)
  },

  async getById(id: number): Promise<BankStatementImport> {
    const response = await api.get(`/bank-statement-imports/${id}`)
    return response.data.data
  },

  async getSummary(id: number, signal?: AbortSignal): Promise<BankStatementAnalysisResult> {
    const response = await api.get(`/bank-statement-imports/${id}/summary`, { signal })
    return response.data.data
  },

  async export(id: number): Promise<Blob> {
    const response = await api.get(`/bank-statement-imports/${id}/export`, {
      responseType: 'blob',
    })
    return response.data
  },

  async getPreview(id: number, limit: number, signal?: AbortSignal): Promise<{
    import: BankStatementImport
    preview_rows: BankStatementPreviewRow[]
    total_rows: number
  }> {
    const response = await api.get(`/bank-statement-imports/${id}/preview`, {
      params: { limit },
      signal
    })
    return response.data.data
  },

  async manualEntry(data: {
    bank_account_id: number
    transaction_date: string
    description: string
    debit_amount: number
    credit_amount: number
    reference_number?: string
    balance?: number
  }) {
    const response = await api.post('/bank-statement-imports/manual', data)
    return response.data.data
  },

  async manualBulkEntry(data: {
    bank_account_id: number
    entries: Array<{
      transaction_date: string
      description: string
      debit_amount: number
      credit_amount: number
      reference_number?: string
      balance?: number
    }>
  }): Promise<{ inserted: number; ids: number[] }> {
    const response = await api.post('/bank-statement-imports/manual/bulk', data)
    return response.data.data
  },

  async hardDeleteStatement(id: number): Promise<void> {
    await api.delete(`/bank-statement-imports/statements/${id}/hard`)
  },

  async hardDeleteBulkStatements(ids: number[]): Promise<{ deleted: number; skipped: number; errors: Array<{ id: number; reason: string }> }> {
    const response = await api.post('/bank-statement-imports/statements/hard-delete', { ids })
    return response.data.data
  },

  async listManualEntries(bankAccountId: number): Promise<Array<{
    month: string
    entries: Array<{
      id: number
      transaction_date: string
      description: string
      debit_amount: number
      credit_amount: number
      reference_number?: string
      balance?: number
      is_reconciled: boolean
    }>
    suggestions: Array<{
      transaction_date: string
      description: string
      credit_amount: number
      debit_amount: number
      payment_method_id: number
    }>
  }>> {
    const response = await api.get('/bank-statement-imports/manual', {
      params: { bank_account_id: bankAccountId },
    })
    return response.data.data
  },
}

