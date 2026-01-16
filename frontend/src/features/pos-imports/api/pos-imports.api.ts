import api from '@/lib/axios'
import type { AnalyzeResult } from '../types/pos-imports.types'

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

export const posImportsApi = {
  list: async (params?: ListParams) => {
    const response = await api.get('/pos-imports', { params })
    return response.data
  },

  getById: async (id: string) => {
    const response = await api.get(`/pos-imports/${id}`)
    return response.data
  },

  upload: async (file: File, branchId: string): Promise<AnalyzeResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('branch_id', branchId)

    const response = await api.post('/pos-imports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000, // 2 minutes
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          // Dispatch custom event for progress tracking
          window.dispatchEvent(new CustomEvent('upload-progress', { detail: percentCompleted }))
        }
      }
    })
    return response.data.data
  },

  confirm: async (id: string, skipDuplicates: boolean = true) => {
    const response = await api.post(`/pos-imports/${id}/confirm`, {
      skip_duplicates: skipDuplicates
    })
    return response.data
  },

  delete: async (id: string) => {
    await api.delete(`/pos-imports/${id}`)
  },

  getLines: async (id: string, page: number = 1, limit: number = 50) => {
    const response = await api.get(`/pos-imports/${id}/lines`, {
      params: { 
        page, 
        limit,
        sort: 'row_number',
        order: 'asc'
      }
    })
    return response.data
  }
}
