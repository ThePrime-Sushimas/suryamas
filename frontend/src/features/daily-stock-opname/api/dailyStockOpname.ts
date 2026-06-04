import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  DailyClosingCount,
  DailyClosingCountDetail,
  DailyClosingCountLine,
  CreateOpnameDto,
  UpdateLineDto,
  BulkUpdateLinesDto,
  ResolveOpnameDto,
  UpsertOpnameConfigDto,
  BranchOpnameConfig,
  OpnameDashboardItem,
  VarianceReportItem,
  VarianceReportFilter,
  OpnameDisplayStatus,
  AnalysisResponse,
  ClassifyDto,
  ClassificationsResponse,
  OpnameReopenRequestWithRelations,
  CreateReopenRequestDto,
  RespondReopenRequestDto,
} from '../types'

// ─── KEYS ────────────────────────────────────────────────────────────────────

const KEYS = {
  list: (p: Record<string, unknown>) => ['daily-stock-opname', p] as const,
  detail: (id: string) => ['daily-stock-opname', id] as const,
  config: (branchId: string) => ['daily-stock-opname', 'config', branchId] as const,
  dashboard: () => ['daily-stock-opname', 'dashboard'] as const,
  varianceReport: (p: Record<string, unknown>) => ['daily-stock-opname', 'variance-report', p] as const,
  reopenRequests: (id: string) => ['daily-stock-opname', id, 'reopen-requests'] as const,
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export const useOpnameList = (params: {
  page?: number
  limit?: number
  branch_id?: string
  status?: OpnameDisplayStatus | ''
  date_from?: string
  date_to?: string
  search?: string
} = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get('/daily-stock-opname', {
        params: { page: 1, limit: 25, ...params },
      })
      return { data: data.data as DailyClosingCount[], pagination: data.pagination }
    },
    staleTime: 30_000,
  })

// ─── DETAIL ──────────────────────────────────────────────────────────────────

export const useOpnameDetail = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/${id}`)
      return data.data as DailyClosingCountDetail
    },
    enabled: !!id,
  })

// ─── ANALYSIS ────────────────────────────────────────────────────────────────

export const useOpnameAnalysis = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['daily-stock-opname', id, 'analysis'],
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/${id}/analysis`)
      return data.data as AnalysisResponse
    },
    enabled: !!id && enabled,
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const useCreateOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateOpnameDto) => {
      const { data } = await api.post('/daily-stock-opname', body)
      return data.data as DailyClosingCountDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-stock-opname'] }),
  })
}

// ─── AVAILABLE POSITIONS ─────────────────────────────────────────────────────

export interface OpnamePosition {
  id: string
  position_code: string
  position_name: string
  department_name: string
}

export const useOpnamePositions = (branchId?: string) =>
  useQuery({
    queryKey: ['daily-stock-opname', 'positions', branchId],
    queryFn: async () => {
      const params = branchId ? { branch_id: branchId } : {}
      const { data } = await api.get('/daily-stock-opname/positions', { params })
      return (data.data || []) as OpnamePosition[]
    },
    enabled: !!branchId,
    staleTime: 60_000,
  })

// ─── UPDATE LINE ─────────────────────────────────────────────────────────────

export const useUpdateLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, lineId, body }: {
      sessionId: string
      lineId: string
      body: UpdateLineDto
    }) => {
      const { data } = await api.patch(
        `/daily-stock-opname/${sessionId}/lines/${lineId}`,
        body,
      )
      return data.data as DailyClosingCountLine
    },
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) }),
  })
}

// ─── BULK UPDATE LINES ───────────────────────────────────────────────────────

export const useBulkUpdateLines = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, body }: {
      sessionId: string
      body: BulkUpdateLinesDto
    }) => {
      const { data } = await api.patch(
        `/daily-stock-opname/${sessionId}/lines/bulk`,
        body,
      )
      return data.data as DailyClosingCountLine[]
    },
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) }),
  })
}

// ─── UPLOAD PHOTO ────────────────────────────────────────────────────────────

export const useUploadPhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, lineId, file }: {
      sessionId: string
      lineId: string
      file: File
    }) => {
      const formData = new FormData()
      formData.append('photo', file)
      const { data } = await api.post(
        `/daily-stock-opname/${sessionId}/lines/${lineId}/photo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data.data as { photo_url: string }
    },
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) }),
  })
}

export const useDeletePhoto = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, lineId }: {
      sessionId: string
      lineId: string
    }) => {
      await api.delete(`/daily-stock-opname/${sessionId}/lines/${lineId}/photo`)
    },
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) }),
  })
}

// ─── CONFIRM ─────────────────────────────────────────────────────────────────

export const useConfirmOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/daily-stock-opname/${id}/confirm`)
      return data.data as DailyClosingCountDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-stock-opname'] }),
  })
}

// ─── RESOLVE ─────────────────────────────────────────────────────────────────

export const useResolveOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ResolveOpnameDto }) => {
      const { data } = await api.post(`/daily-stock-opname/${id}/resolve`, body)
      return data.data as DailyClosingCountDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-stock-opname'] }),
  })
}

// ─── CANCEL ──────────────────────────────────────────────────────────────────

export const useCancelOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/daily-stock-opname/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-stock-opname'] }),
  })
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

export const useOpnameConfig = (branchId: string) =>
  useQuery({
    queryKey: KEYS.config(branchId),
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/config/${branchId}`)
      return data.data as BranchOpnameConfig
    },
    enabled: !!branchId,
  })

export const useUpdateOpnameConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ branchId, body }: {
      branchId: string
      body: UpsertOpnameConfigDto
    }) => {
      const { data } = await api.put(
        `/daily-stock-opname/config/${branchId}`,
        body,
      )
      return data.data as BranchOpnameConfig
    },
    onSuccess: (_, { branchId }) =>
      qc.invalidateQueries({ queryKey: KEYS.config(branchId) }),
  })
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export const useOpnameDashboard = () =>
  useQuery({
    queryKey: KEYS.dashboard(),
    queryFn: async () => {
      const { data } = await api.get('/daily-stock-opname/dashboard')
      return data.data as OpnameDashboardItem[]
    },
    staleTime: 60_000,
  })

// ─── VARIANCE REPORT ─────────────────────────────────────────────────────────

export const useVarianceReport = (params: VarianceReportFilter) =>
  useQuery({
    queryKey: KEYS.varianceReport(params as unknown as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get('/daily-stock-opname/variance-report', { params })
      return data.data as VarianceReportItem[]
    },
    enabled: !!params.date_from && !!params.date_to,
    staleTime: 60_000,
  })

// ─── EXPORT VARIANCE REPORT CSV ──────────────────────────────────────────────

export const useExportVarianceReportCsv = () =>
  useMutation({
    mutationFn: async (params: VarianceReportFilter) => {
      const { data } = await api.get('/daily-stock-opname/variance-report/export', {
        params,
        responseType: 'blob',
      })
      // Trigger browser download
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `variance-report-${params.date_from}-${params.date_to}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })

// ─── CLASSIFY ────────────────────────────────────────────────────────────────

export const useClassifyOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: string; body: ClassifyDto }) => {
      const { data } = await api.post(`/daily-stock-opname/${sessionId}/classify`, body)
      return data.data
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: ['daily-stock-opname', sessionId, 'classifications'] })
    },
  })
}

// ─── CLASSIFICATIONS ─────────────────────────────────────────────────────────

export const useOpnameClassifications = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['daily-stock-opname', id, 'classifications'],
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/${id}/classifications`)
      return data.data as ClassificationsResponse
    },
    enabled: !!id && enabled,
  })

// ─── REOPEN REQUESTS ─────────────────────────────────────────────────────────

export const useReopenRequests = (id: string) =>
  useQuery({
    queryKey: KEYS.reopenRequests(id),
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/${id}/reopen-requests`)
      return data.data as OpnameReopenRequestWithRelations[]
    },
    enabled: !!id,
  })

export const useCreateReopenRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, body }: {
      sessionId: string
      body: CreateReopenRequestDto
    }) => {
      const { data } = await api.post(
        `/daily-stock-opname/${sessionId}/reopen-request`,
        body,
      )
      return data.data as OpnameReopenRequestWithRelations
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: KEYS.reopenRequests(sessionId) })
    },
  })
}

export const useApproveReopenRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (variables: {
      requestId: string
      sessionId: string
      body: RespondReopenRequestDto
    }) => {
      const { data } = await api.post(
        `/daily-stock-opname/reopen-requests/${variables.requestId}/approve`,
        variables.body,
      )
      return data.data as OpnameReopenRequestWithRelations
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: KEYS.reopenRequests(sessionId) })
    },
  })
}

export const useRejectReopenRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (variables: {
      requestId: string
      sessionId: string
      body: RespondReopenRequestDto
    }) => {
      const { data } = await api.post(
        `/daily-stock-opname/reopen-requests/${variables.requestId}/reject`,
        variables.body,
      )
      return data.data as OpnameReopenRequestWithRelations
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: KEYS.reopenRequests(sessionId) })
    },
  })
}
