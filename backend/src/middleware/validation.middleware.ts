import { Request, Response, NextFunction } from 'express'
import { ZodTypeAny } from 'zod'
import { sendError } from '../utils/response.util'

/**
 * Type-safe validated request with proper output type inference
 * Preserves all Request properties while adding validated data
 */
export type ValidatedRequest<T extends ZodTypeAny> = Request & {
  validated: T['_output']
}

/**
 * Type-safe validation middleware with proper generic inference
 */
export const validateSchema = <T extends ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only check body size if body exists and is an object
    if (req.body && typeof req.body === 'object') {
      try {
        const bodySize = Buffer.byteLength(JSON.stringify(req.body))
        if (bodySize > 1024 * 1024) {
          return sendError(res, 'Request body too large', 413)
        }
      } catch (err) {
        // If stringify fails, let validation handle it
        // Don't block the request here
      }
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

    // Type system: Express doesn't know req.validated exists
    // This is acceptable - enforcement happens in controller via ValidatedRequest<T>
    (req as any).validated = result.data
    next()
  }
}
