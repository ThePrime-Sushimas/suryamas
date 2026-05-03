import api from '@/lib/axios'
import type {
  FiscalPeriod,
  FiscalPeriodWithDetails,
  CreateFiscalPeriodDto,
  UpdateFiscalPeriodDto,
  ClosePeriodDto,
  ClosePeriodWithEntriesDto,
  PeriodClosingSummary,
  ClosePeriodWithEntriesResult,
  FiscalPeriodFilter,
} from '../types/fiscal-period.types'

const BASE_URL = '/accounting/fiscal-periods'

interface ApiResponse<T> {
  success: boolean
  message: string
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

type FiscalPeriodListApiResponse = ApiResponse<FiscalPeriodWithDetails[]>

export const fiscalPeriodsApi = {
  list: async (params: FiscalPeriodFilter & { page?: number; limit?: number }) => {
    const { data } = await api.get<FiscalPeriodListApiResponse>(BASE_URL, { params })
    return data
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<FiscalPeriodWithDetails>>(`${BASE_URL}/${id}`)
    return data
  },

  create: async (dto: CreateFiscalPeriodDto) => {
    const { data } = await api.post<FiscalPeriod>(BASE_URL, dto)
    return data
  },

  update: async (id: string, dto: UpdateFiscalPeriodDto) => {
    const { data } = await api.put<FiscalPeriod>(`${BASE_URL}/${id}`, dto)
    return data
  },

  /** @deprecated Use closePeriodWithEntries instead */
  close: async (id: string, dto: ClosePeriodDto) => {
    const { data } = await api.post<FiscalPeriod>(`${BASE_URL}/${id}/close`, dto)
    return data
  },

  getClosingPreview: async (id: string): Promise<PeriodClosingSummary> => {
    const { data } = await api.get<ApiResponse<PeriodClosingSummary>>(`${BASE_URL}/${id}/closing-preview`)
    return data.data
  },

  closePeriodWithEntries: async (id: string, dto: ClosePeriodWithEntriesDto): Promise<ClosePeriodWithEntriesResult> => {
    const { data } = await api.post<ApiResponse<ClosePeriodWithEntriesResult>>(`${BASE_URL}/${id}/close-with-entries`, dto)
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`)
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await api.post(`${BASE_URL}/bulk/delete`, { ids })
  },

  restore: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}/${id}/restore`)
  },

  bulkRestore: async (ids: string[]): Promise<void> => {
    await api.post(`${BASE_URL}/bulk/restore`, { ids })
  },

  getExportToken: async () => {
    const { data } = await api.get<{ token: string }>(`${BASE_URL}/export/token`)
    return data.token
  },

  export: async (token: string, filters?: FiscalPeriodFilter) => {
    const params = new URLSearchParams({ token })
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value))
        }
      })
    }
    window.open(`${api.defaults.baseURL}${BASE_URL}/export?${params}`, '_blank')
  },
}
