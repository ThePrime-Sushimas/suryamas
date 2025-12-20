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

export function getPaginationParams(query: any, maxLimit?: number): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = query.limit ? Math.min(maxLimit || Infinity, Math.max(1, parseInt(query.limit))) : (maxLimit || Infinity)
  const offset = (page - 1) * limit

  return { page, limit: limit === Infinity ? Number.MAX_SAFE_INTEGER : limit, offset }
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit)

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
