import { Request, Response, NextFunction } from 'express'
import { getPaginationParams } from '../utils/pagination.util'

export interface PaginatedRequest extends Request {
  pagination: {
    page: number
    limit: number
    offset: number
  }
}

export const paginationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const pagination = getPaginationParams(req.query)
  ;(req as PaginatedRequest).pagination = pagination
  next()
}
