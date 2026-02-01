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

export const getPaginationParams = (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.max(1, Number(query.limit) || 500)
  const offset = calculateOffset(page, limit)
  return { page, limit, offset }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  return {
    data,
    pagination: calculatePagination({ page, limit }, total)
  }
}
