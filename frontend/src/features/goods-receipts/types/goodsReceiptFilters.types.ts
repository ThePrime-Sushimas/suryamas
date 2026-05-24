export interface GoodsReceiptFilters {
  page: number
  limit: number
  search: string
  status: string
}

export type GoodsReceiptFilterPatch = Partial<GoodsReceiptFilters>

export interface GoodsReceiptListQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
}
