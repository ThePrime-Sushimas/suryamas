import api from '@/lib/axios'
import type {
  JournalLineWithDetails,
  JournalLineFilter,
  JournalLineListResponse,
  JournalLinesByAccountResponse,
} from '../types/journal-line.types'

const BASE_URL = '/accounting/journal-lines'

export const journalLinesApi = {
  list: async (params: JournalLineFilter & { page?: number; limit?: number }) => {
    const { data } = await api.get<JournalLineListResponse>(BASE_URL, { params })
    return data
  },

  getByJournal: async (journalId: string) => {
    const { data } = await api.get<JournalLineWithDetails[]>(`${BASE_URL}/journals/${journalId}/lines`)
    return data
  },

  getByAccount: async (accountId: string, params?: JournalLineFilter) => {
    const { data } = await api.get<JournalLinesByAccountResponse>(`${BASE_URL}/by-account/${accountId}`, { params })
    return data
  },

  getById: async (journalId: string, lineId: string) => {
    const { data } = await api.get<JournalLineWithDetails>(`${BASE_URL}/journals/${journalId}/lines/${lineId}`)
    return data
  },
}
