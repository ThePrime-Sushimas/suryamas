import api from '@/lib/axios'
import type {
  StagingTable,
  StagingListParams,
  StagingListResponse,
  StagingRow,
  StagingUpdatePayload,
} from '../types/pos-staging.types'

type ApiResponse<T> = { success: boolean; data: T }

export const posStagingApi = {
  list: async (table: StagingTable, params: StagingListParams = {}): Promise<StagingListResponse> => {
    const p = new URLSearchParams()
    if (params.status) p.append('status', params.status)
    if (params.page)   p.append('page',   String(params.page))
    if (params.limit)  p.append('limit',  String(params.limit))
    const res = await api.get<StagingListResponse>(`/pos-sync/staging/${table}?${p}`)
    return res.data
  },

  update: async (
    table: StagingTable,
    posId: number,
    payload: StagingUpdatePayload,
  ): Promise<StagingRow> => {
    const res = await api.patch<ApiResponse<StagingRow>>(
      `/pos-sync/staging/${table}/${posId}`,
      payload,
    )
    return res.data.data
  },
}
