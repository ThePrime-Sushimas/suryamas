import { Request } from 'express'
import type { PermissionMatrix } from './permission.types'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    [key: string]: any
  }
  permissions?: PermissionMatrix
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationMeta
}