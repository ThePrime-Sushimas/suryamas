import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.util'
import { logError } from '../config/logger'

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logError('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    user: (req as any).user?.id
  })
  
  sendError(res, err.message || 'Internal server error', 500)
}