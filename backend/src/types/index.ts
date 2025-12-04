import { Request } from 'express'

export interface User {
  id: string
  email: string
  full_name?: string
  phone?: string
  role?: string
}

export interface AuthRequest extends Request {
  user?: any
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}