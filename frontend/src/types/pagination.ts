export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages?: number
}

export interface Paginated<T> {
  success: boolean
  data: T[]
  pagination: PaginationMeta
}
