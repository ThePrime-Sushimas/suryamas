import api from '@/lib/axios'
import type { AnalyzeResult, PosImport, PosImportLine } from '../types/pos-imports.types'

// Constants with descriptive naming
export const POS_IMPORT_MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
export const POS_IMPORT_UPLOAD_TIMEOUT = 120000 // 2 minutes
export const POS_IMPORT_DEFAULT_PAGE_SIZE = 50

const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
]

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

function validateFile(file: File): void {
  // Check file size
  if (file.size > POS_IMPORT_MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${POS_IMPORT_MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    // Fallback to extension check if MIME type is not set
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    )
    if (!hasValidExtension) {
      throw new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed')
    }
  }

  // Check if file is empty
  if (file.size === 0) {
    throw new Error('File is empty')
  }
}

interface ListParams {
  page?: number
  limit?: number
  branch_id?: string
  status?: string
  date_from?: string
  date_to?: string
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}

interface ListResponse {
  data: PosImport[]
  pagination?: {
    total: number
    page: number
    limit: number
  }
}

interface LinesResponse {
  data: PosImportLine[]
  pagination?: {
    total: number
    page: number
    limit: number
  }
}

export const posImportsApi = {
  list: async (params?: ListParams, signal?: AbortSignal): Promise<ListResponse> => {
    const response = await api.get('/pos-imports', { params, signal })
    return response.data
  },

  getById: async (id: string, signal?: AbortSignal): Promise<{ data: PosImport }> => {
    const response = await api.get(`/pos-imports/${id}`, { signal })
    return response.data
  },

  upload: async (
    file: File,
    branchId: string,
    signal?: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<AnalyzeResult> => {
    // Validate file before upload
    validateFile(file)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('branch_id', branchId)
    // Note: File metadata is automatically added by axios interceptor

    const response = await api.post('/pos-imports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: POS_IMPORT_UPLOAD_TIMEOUT,
      signal,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      }
    })
    return response.data.data
  },

  confirm: async (id: string, skipDuplicates: boolean = true, signal?: AbortSignal) => {
    const response = await api.post(`/pos-imports/${id}/confirm`, {
      skip_duplicates: skipDuplicates
    }, { signal })
    return response.data
  },

  delete: async (id: string, signal?: AbortSignal) => {
    await api.delete(`/pos-imports/${id}`, { signal })
  },

  getLines: async (
    id: string,
    page: number = 1,
    limit: number = POS_IMPORT_DEFAULT_PAGE_SIZE,
    signal?: AbortSignal
  ): Promise<LinesResponse> => {
    const response = await api.get(`/pos-imports/${id}/lines`, {
      params: { 
        page, 
        limit,
        sort: 'row_number',
        order: 'asc'
      },
      signal
    })
    return response.data
  },

  export: async (id: string, signal?: AbortSignal): Promise<Blob> => {
    const response = await api.get(`/pos-imports/${id}/export`, {
      responseType: 'blob',
      signal
    })
    return response.data
  },

  getSummary: async (id: string, signal?: AbortSignal): Promise<{
    totalAmount: number
    totalTax: number
    totalDiscount: number
    totalBillDiscount: number
    totalAfterBillDiscount: number
    transactionCount: number
  }> => {
    const response = await api.get(`/pos-imports/${id}/summary`, { signal })
    return response.data.data
  },

  updateStatus: async (id: string, status: string, signal?: AbortSignal): Promise<{ data: PosImport }> => {
    const response = await api.put(`/pos-imports/${id}/status`, { status }, { signal })
    return response.data
  },

  // Batch export - creates a job and returns job ID
  batchExport: async (ids: string[]): Promise<{ job_id: string; status: string }> => {
    const response = await api.post('/pos-imports/export/job', { ids })
    return response.data.data
  }
}
