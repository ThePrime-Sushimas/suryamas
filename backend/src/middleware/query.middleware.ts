import { Request, Response, NextFunction } from 'express'
import type { PaginationParams, SortParams } from '../types/request.types'

export interface QueryRequest extends Request {
  pagination?: PaginationParams
  sort?: SortParams
  filterParams?: Record<string, any>
}

interface QueryMiddlewareOptions {
  allowedSortFields?: string[]
  pagination?: boolean
  defaultSort?: string
}

export const queryMiddleware = (options: QueryMiddlewareOptions = {}) => {
  const {
    allowedSortFields = ['id', 'created_at', 'updated_at'],
    pagination = true,
    defaultSort = 'id'
  } = options

  return (req: QueryRequest, res: Response, next: NextFunction) => {
    try {
      // Pagination (optional)
      const noPagination = req.query.no_pagination === 'true'
      if (pagination && !noPagination) {
        const page = Math.max(1, parseInt(req.query.page as string) || 1)
        const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit as string) || 10))
        req.pagination = { page, limit }
      }

      // Sort
      const sortField = (req.query.sort as string) || defaultSort
      const sortOrder = (req.query.order as string) || 'asc'

      if (!allowedSortFields.includes(sortField)) {
        const error = new Error(`Invalid sort field. Allowed: ${allowedSortFields.join(', ')}`)
        return next(error)
      }

      if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
        const error = new Error('Invalid sort order. Use "asc" or "desc"')
        return next(error)
      }

      req.sort = {
        field: sortField,
        order: sortOrder.toLowerCase() as 'asc' | 'desc'
      }

      // Filter
      const filter: Record<string, any> = {}
      const excludedParams = ['page', 'limit', 'sort', 'order', 'q', '_', 'no_pagination']
      
      Object.keys(req.query).forEach(key => {
        if (!excludedParams.includes(key) && req.query[key] !== undefined && req.query[key] !== '') {
          const value = req.query[key]
          
          // Handle bracket notation like filter[status], filter[city]
          if (key.includes('[') && key.includes(']')) {
            const cleanKey = key.match(/\[(.*?)\]/)?.[1]
            if (cleanKey) {
              if (value === 'true' || value === 'false') {
                filter[cleanKey] = value === 'true'
              } else if (!isNaN(Number(value))) {
                filter[cleanKey] = Number(value)
              } else {
                filter[cleanKey] = value
              }
            }
          } else {
            if (value === 'true' || value === 'false') {
              filter[key] = value === 'true'
            } else if (!isNaN(Number(value))) {
              filter[key] = Number(value)
            } else {
              filter[key] = value
            }
          }
        }
      })
      
      req.filterParams = Object.keys(filter).length > 0 ? filter : undefined
      next()
    } catch (error) {
      next(error)
    }
  }
}

// Backward compatibility exports
export const paginationMiddleware = queryMiddleware()
export const sortMiddleware = queryMiddleware()
export const filterMiddleware = queryMiddleware()