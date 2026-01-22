import { Request, Response, NextFunction } from 'express'
import { z, ZodTypeAny } from '../lib/openapi'
import { sendError } from '../utils/response.util'
import type { AuthRequest } from '../types/common.types'

/**
 * Type-safe validated request with proper output type inference
 */
export type ValidatedRequest<T extends ZodTypeAny> = Request & {
  validated: T['_output']
}

/**
 * Type-safe validated request with auth context
 */
export type ValidatedAuthRequest<T extends ZodTypeAny> = ValidatedRequest<T> & AuthRequest

/**
 * Recursively convert query params to handle string | string[] issue
 * Zod's coerce works better when values are consistently typed
 */
function normalizeQueryParams(obj: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // Take first value for single-value params, or join with comma for multi-value
      normalized[key] = value[0] ?? ''
    } else {
      normalized[key] = value
    }
  }
  
  return normalized
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

    // Normalize query params to handle string | string[] issue
    const normalizedQuery = normalizeQueryParams(req.query)

    const result = schema.safeParse({
      params: req.params,
      query: normalizedQuery,
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
