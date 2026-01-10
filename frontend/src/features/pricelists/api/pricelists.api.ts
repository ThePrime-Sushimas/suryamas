/**
 * Pricelist API Client
 * Type-safe REST API integration
 * 
 * @module pricelists/api
 */

import axiosInstance from '@/lib/axios'
import type {
  Pricelist,
  PricelistWithRelations,
  CreatePricelistDto,
  UpdatePricelistDto,
  PricelistApprovalDto,
  PricelistListQuery,
  PricelistListResponse,
  PricelistLookupQuery,
  PricelistLookupResponse
} from '../types/pricelist.types'

const BASE_URL = '/pricelists'

/**
 * Unwrap API response data consistently
 */
function unwrapData<T>(response: { data: unknown }): T {
  // For list responses, return the whole response (data + pagination)
  // For single item responses, return just the data
  const responseData = response.data as Record<string, unknown>
  
  // If response has both 'data' and 'pagination', return the whole response
  if (responseData?.data && responseData?.pagination) {
    return responseData as T
  }
  
  // Otherwise return just the data field or the whole response
  return (responseData?.data ?? response.data) as T
}

/**
 * Build query string from params
 * Removes undefined/null values
 */
function buildQueryString(params: Record<string, unknown>): string {
  const filtered = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  
  return filtered ? `?${filtered}` : ''
}

export const pricelistsApi = {
  /**
   * List pricelists with pagination and filters
   */
  async list(query: PricelistListQuery = {}, signal?: AbortSignal): Promise<PricelistListResponse> {
    const queryString = buildQueryString(query as Record<string, unknown>)
    const response = await axiosInstance.get<PricelistListResponse>(`${BASE_URL}${queryString}`, { signal })
    return unwrapData<PricelistListResponse>(response)
  },

  /**
   * Get single pricelist by ID
   */
  async getById(id: string, signal?: AbortSignal): Promise<PricelistWithRelations> {
    const response = await axiosInstance.get(`${BASE_URL}/${id}`, { signal })
    return unwrapData<PricelistWithRelations>(response)
  },

  /**
   * Create new pricelist
   */
  async create(data: CreatePricelistDto): Promise<Pricelist> {
    const response = await axiosInstance.post(BASE_URL, data)
    return unwrapData<Pricelist>(response)
  },

  /**
   * Update existing pricelist (DRAFT only)
   */
  async update(id: string, data: UpdatePricelistDto): Promise<Pricelist> {
    const response = await axiosInstance.patch(`${BASE_URL}/${id}`, data)
    return unwrapData<Pricelist>(response)
  },

  /**
   * Delete pricelist (soft delete)
   */
  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`${BASE_URL}/${id}`)
  },

  /**
   * Approve or reject pricelist
   */
  async approve(id: string, data: PricelistApprovalDto): Promise<Pricelist> {
    const response = await axiosInstance.post(`${BASE_URL}/${id}/approve`, data)
    return unwrapData<Pricelist>(response)
  },

  /**
   * Lookup pricelist for PO integration
   * Find active approved pricelist for specific combination
   */
  async lookup(query: PricelistLookupQuery, signal?: AbortSignal): Promise<PricelistLookupResponse> {
    const queryString = buildQueryString(query as unknown as Record<string, unknown>)
    const response = await axiosInstance.get<PricelistLookupResponse>(`${BASE_URL}/lookup${queryString}`, { signal })
    return unwrapData<PricelistLookupResponse>(response)
  },

  /**
   * Export pricelists to CSV
   */
  async exportCSV(query: PricelistListQuery = {}): Promise<Blob> {
    const queryString = buildQueryString(query as Record<string, unknown>)
    const response = await axiosInstance.get(`${BASE_URL}/export${queryString}`, {
      responseType: 'blob'
    })
    return response.data
  }
}
