import { Response } from 'express'
import { ApiResponse } from '../types/common.types'

export const sendSuccess = (
  res: Response,
  data: any,
  message = 'Success',
  statusCode = 200,
  pagination?: any
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(pagination && { pagination }),
  })
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