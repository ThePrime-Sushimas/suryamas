import { Request, Response, NextFunction } from 'express'

/**
 * Wrapper for validated request handlers
 * Ensures validation middleware has been applied before handler executes
 */
export const withValidated = (handler: any) => {
  return (req: Request, res: Response, next?: NextFunction) => {
    if (!req.hasOwnProperty('validated')) {
      res.status(500).json({ error: 'Validation middleware not applied' })
      return
    }
    return handler(req, res)
  }
}
