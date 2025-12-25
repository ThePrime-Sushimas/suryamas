import { Response } from 'express'
import { ZodError } from 'zod'
import { sendError } from './response.util'
import { logError } from '../config/logger'

export interface AppError extends Error {
  code?: string
  statusCode?: number
}

export const handleError = (res: Response, error: unknown): void => {
  // Domain / custom error
  if (error instanceof Error && 'statusCode' in error) {
    const err = error as AppError
    logError(err.code || 'APP_ERROR', { message: err.message })
    sendError(res, err.message, err.statusCode || 400)
    return
  }

  // Zod validation error
  if (error instanceof ZodError) {
    sendError(
      res,
      error.issues[0]?.message || 'Invalid input',
      400
    )
    return
  }

  // Generic error
  if (error instanceof Error) {
    logError('UNEXPECTED_ERROR', { message: error.message })
    sendError(res, 'Internal server error', 500)
    return
  }

  // Truly unknown
  logError('UNKNOWN_ERROR', { error })
  sendError(res, 'Internal server error', 500)
}
