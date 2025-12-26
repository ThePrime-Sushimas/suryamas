import { Request, Response, NextFunction } from 'express'
import type { PaginationParams } from '../types/request.types'

export const paginationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit as string) || 10))

  ;(req as Request & { pagination: PaginationParams }).pagination = {
    page,
    limit,
  }

  next()
}
