import api from '@/lib/axios'
import type {
  JournalHeader,
  JournalHeaderWithLines,
  CreateJournalDto,
  UpdateJournalDto,
  RejectJournalDto,
  ReverseJournalDto,
  JournalHeaderFilter,
} from '../types/journal-header.types'

interface PaginationResponse {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const BASE_URL = '/accounting/journals'

export const journalHeadersApi = {
  list: async (params: JournalHeaderFilter & { page?: number; limit?: number }) => {
    const { data } = await api.get<{ success: boolean; message: string; data: JournalHeader[]; pagination: PaginationResponse }>(BASE_URL, { params })
    return { data: data.data, pagination: data.pagination }
  },

  getById: async (id: string) => {
    const { data } = await api.get<{ success: boolean; message: string; data: JournalHeaderWithLines }>(`${BASE_URL}/${id}`)
    return data.data
  },

  create: async (dto: CreateJournalDto) => {
    const { data } = await api.post<{ success: boolean; message: string; data: JournalHeaderWithLines }>(BASE_URL, dto)
    return data.data
  },

  update: async (id: string, dto: UpdateJournalDto) => {
    const { data } = await api.put<{ success: boolean; message: string; data: JournalHeaderWithLines }>(`${BASE_URL}/${id}`, dto)
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`)
  },

  restore: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}/${id}/restore`)
  },

  submit: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}/${id}/submit`)
  },

  approve: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}/${id}/approve`)
  },

  reject: async (id: string, dto: RejectJournalDto): Promise<void> => {
    await api.post(`${BASE_URL}/${id}/reject`, dto)
  },

  post: async (id: string): Promise<void> => {
    await api.post(`${BASE_URL}/${id}/post`)
  },

  reverse: async (id: string, dto: ReverseJournalDto) => {
    const { data } = await api.post<{ success: boolean; message: string; data: JournalHeaderWithLines }>(`${BASE_URL}/${id}/reverse`, dto)
    return data.data
  },
}
