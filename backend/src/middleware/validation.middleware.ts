import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { sendError } from '../utils/response.util'

/**
 * Middleware to validate request data against Zod schema
 */
export const validateSchema = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check request size limits
    const bodySize = JSON.stringify(req.body).length
    if (bodySize > 1024 * 1024) { // 1MB limit
      return sendError(res, 'Request body too large', 413)
    }

    const result = schema.safeParse({
      params: req.params,
      query: req.query,
      body: req.body,
    })
    
    if (!result.success) {
      const validationErrors = result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))
      return sendError(res, 'Validation failed', 422, {
        validation_errors: validationErrors,
      })
    }
    
    // Safely assign validated data
    const validatedData = result.data as any
    if (validatedData.params) req.params = validatedData.params
    if (validatedData.query) req.query = validatedData.query
    if (validatedData.body) req.body = validatedData.body
    
    next()
  }
}