/**
 * Pricelist API Client
 * Type-safe REST API integration
 * 
 * @module pricelists/api
 */

import axios from '@/lib/axios'
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
    const response = await axios.get<PricelistListResponse>(`${BASE_URL}${queryString}`, { signal })
    return response.data
  },

  /**
   * Get single pricelist by ID
   */
  async getById(id: string, signal?: AbortSignal): Promise<PricelistWithRelations> {
    const response = await axios.get(`${BASE_URL}/${id}`, { signal })
    return response.data.data || response.data
  },

  /**
   * Create new pricelist
   */
  async create(data: CreatePricelistDto): Promise<Pricelist> {
    try {
      const response = await axios.post(BASE_URL, data)
      return response.data.data || response.data
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      console.error('Backend error response:', axiosError.response?.data)
      console.error('Request data:', data)
      // Show user-friendly error for foreign key constraint
      if (axiosError.response?.data?.error?.includes('foreign key constraint')) {
        throw new Error('Selected UOM is not valid. Please choose a different UOM.')
      }
      throw error
    }
  },

  /**
   * Update existing pricelist (DRAFT only)
   */
  async update(id: string, data: UpdatePricelistDto): Promise<Pricelist> {
    const response = await axios.patch<Pricelist>(`${BASE_URL}/${id}`, data)
    return response.data
  },

  /**
   * Delete pricelist (soft delete)
   */
  async delete(id: string): Promise<void> {
    await axios.delete(`${BASE_URL}/${id}`)
  },

  /**
   * Approve or reject pricelist
   */
  async approve(id: string, data: PricelistApprovalDto): Promise<Pricelist> {
    const response = await axios.post<Pricelist>(`${BASE_URL}/${id}/approve`, data)
    return response.data
  },

  /**
   * Lookup pricelist for PO integration
   * Find active approved pricelist for specific combination
   */
  async lookup(query: PricelistLookupQuery, signal?: AbortSignal): Promise<PricelistLookupResponse> {
    const queryString = buildQueryString(query as unknown as Record<string, unknown>)
    const response = await axios.get<PricelistLookupResponse>(`${BASE_URL}/lookup${queryString}`, { signal })
    return response.data
  },

  /**
   * Export pricelists to CSV
   */
  async exportCSV(query: PricelistListQuery = {}): Promise<Blob> {
    const queryString = buildQueryString(query as Record<string, unknown>)
    const response = await axios.get(`${BASE_URL}/export${queryString}`, {
      responseType: 'blob'
    })
    return response.data
  }
}
