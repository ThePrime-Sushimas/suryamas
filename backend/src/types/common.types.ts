import { Request } from 'express'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    [key: string]: any
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}