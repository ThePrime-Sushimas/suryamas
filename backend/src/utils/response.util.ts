import { Response } from 'express'
import { ApiResponse } from '../types/common.types'

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message
  }
  res.status(statusCode).json(response)
}

export const sendError = (
  res: Response,
  error: string,
  statusCode = 500
): void => {
  const response: ApiResponse = {
    success: false,
    error
  }
  res.status(statusCode).json(response)
}