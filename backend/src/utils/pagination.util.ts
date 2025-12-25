export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function getPaginationParams(
  query: any,
  maxLimit: number = 1000,
  defaultLimit: number = 25
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = query.limit
    ? Math.min(maxLimit, Math.max(1, parseInt(query.limit)))
    : defaultLimit
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}
