import { Request } from 'express'
import type { PermissionMatrix } from '../modules/permissions/permissions.types'

export interface BranchContext {
  company_id: string
  branch_id: string
  branch_name: string
  employee_id: string
  role_id: string
  approval_limit: number
}

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    [key: string]: any
  }
  permissions?: PermissionMatrix
  context?: BranchContext
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  filterParams?: Record<string, any>
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