import api from '@/lib/axios'
import type {
  BankStatementImport,
  BankStatementAnalysisResult,
  BankStatementImportFilters,
} from '../types/bank-statement-import.types'

interface ListResponse {
  data: BankStatementImport[]
  pagination?: {
    page: number
    limit: number
    total: number
  }
}

export const bankStatementImportApi = {
  async list(params: { page?: number; limit?: number } & BankStatementImportFilters = {}): Promise<ListResponse> {
    const response = await api.get('/bank-statement-imports', {
      params,
    })
    return response.data
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

  async confirm(id: number, payload: { skip_duplicates: boolean }): Promise<{ job_id?: string }> {
    const response = await api.post(`/bank-statement-imports/${id}/confirm`, payload)
    return response.data.data
  },

  async cancel(id: number): Promise<void> {
    await api.post(`/bank-statement-imports/${id}/cancel`)
  },

  async retry(id: number): Promise<{ job_id?: string }> {
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

  async getSummary(id: number): Promise<BankStatementAnalysisResult> {
    const response = await api.get(`/bank-statement-imports/${id}/summary`)
    return response.data.data
  },
}

