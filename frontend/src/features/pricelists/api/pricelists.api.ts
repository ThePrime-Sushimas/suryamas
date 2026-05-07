import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/lib/axios'
import type {
  Pricelist, PricelistWithRelations, CreatePricelistDto, UpdatePricelistDto,
  PricelistApprovalDto, PricelistListQuery, PricelistListResponse, PricelistLookupQuery, PricelistLookupResponse
} from '../types/pricelist.types'

const BASE_URL = '/pricelists'

function unwrapData<T>(response: { data: unknown }): T {
  const responseData = response.data as Record<string, unknown>
  if (responseData?.data && responseData?.pagination) return responseData as T
  return (responseData?.data ?? response.data) as T
}

function buildQueryString(params: Record<string, unknown>): string {
  const filtered = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return filtered ? `?${filtered}` : ''
}

// ── React Query Hooks ──

export const usePricelists = (query: PricelistListQuery = {}) =>
  useQuery({
    queryKey: ['pricelists', query],
    queryFn: async () => {
      const qs = buildQueryString(query as Record<string, unknown>)
      const response = await axiosInstance.get<PricelistListResponse>(`${BASE_URL}${qs}`)
      return unwrapData<PricelistListResponse>(response)
    },
    staleTime: 60_000,
  })

export const usePricelist = (id: string) =>
  useQuery({
    queryKey: ['pricelists', id],
    queryFn: async () => {
      const response = await axiosInstance.get(`${BASE_URL}/${id}`)
      return unwrapData<PricelistWithRelations>(response)
    },
    enabled: !!id,
  })

export const useCreatePricelist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreatePricelistDto) => {
      const response = await axiosInstance.post(BASE_URL, data)
      return unwrapData<Pricelist>(response)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricelists'] }),
  })
}

export const useUpdatePricelist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePricelistDto & { id: string }) => {
      const response = await axiosInstance.patch(`${BASE_URL}/${id}`, data)
      return unwrapData<Pricelist>(response)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricelists'] }),
  })
}

export const useDeletePricelist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await axiosInstance.delete(`${BASE_URL}/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricelists'] }),
  })
}

export const useApprovePricelist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: PricelistApprovalDto & { id: string }) => {
      const response = await axiosInstance.post(`${BASE_URL}/${id}/approve`, data)
      return unwrapData<Pricelist>(response)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricelists'] }),
  })
}

export const useRestorePricelist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await axiosInstance.post(`${BASE_URL}/${id}/restore`)
      return unwrapData<Pricelist>(response)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricelists'] }),
  })
}

// ── Legacy API object (kept for complex form pages) ──

export const pricelistsApi = {
  async list(query: PricelistListQuery = {}, signal?: AbortSignal): Promise<PricelistListResponse> {
    const qs = buildQueryString(query as Record<string, unknown>)
    const response = await axiosInstance.get<PricelistListResponse>(`${BASE_URL}${qs}`, { signal })
    return unwrapData<PricelistListResponse>(response)
  },
  async getById(id: string, signal?: AbortSignal): Promise<PricelistWithRelations> {
    const response = await axiosInstance.get(`${BASE_URL}/${id}`, { signal })
    return unwrapData<PricelistWithRelations>(response)
  },
  async create(data: CreatePricelistDto): Promise<Pricelist> {
    const response = await axiosInstance.post(BASE_URL, data)
    return unwrapData<Pricelist>(response)
  },
  async update(id: string, data: UpdatePricelistDto): Promise<Pricelist> {
    const response = await axiosInstance.patch(`${BASE_URL}/${id}`, data)
    return unwrapData<Pricelist>(response)
  },
  async delete(id: string): Promise<void> { await axiosInstance.delete(`${BASE_URL}/${id}`) },
  async approve(id: string, data: PricelistApprovalDto): Promise<Pricelist> {
    const response = await axiosInstance.post(`${BASE_URL}/${id}/approve`, data)
    return unwrapData<Pricelist>(response)
  },
  async lookup(query: PricelistLookupQuery, signal?: AbortSignal): Promise<PricelistLookupResponse> {
    const qs = buildQueryString(query as unknown as Record<string, unknown>)
    const response = await axiosInstance.get<PricelistLookupResponse>(`${BASE_URL}/lookup${qs}`, { signal })
    return unwrapData<PricelistLookupResponse>(response)
  },
  async restore(id: string): Promise<Pricelist> {
    const response = await axiosInstance.post(`${BASE_URL}/${id}/restore`)
    return unwrapData<Pricelist>(response)
  },
  async exportCSV(query: PricelistListQuery = {}): Promise<Blob> {
    const qs = buildQueryString(query as Record<string, unknown>)
    const response = await axiosInstance.get(`${BASE_URL}/export${qs}`, { responseType: 'blob' })
    return response.data
  },
}
