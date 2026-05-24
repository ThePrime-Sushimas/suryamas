import type { GpListStatusPreset } from '../constants'

export interface GoodsProcessingFilters {
  page: number
  limit: number
  search: string
  status: GpListStatusPreset
}

export type GoodsProcessingFilterPatch = Partial<GoodsProcessingFilters>

export interface GoodsProcessingListQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
}
