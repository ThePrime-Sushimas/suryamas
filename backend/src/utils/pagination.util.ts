export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export const calculatePagination = (
  params: PaginationParams,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / params.limit)
  
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  }
}

export const calculateOffset = (page: number, limit: number): number => {
  return (page - 1) * limit
}
