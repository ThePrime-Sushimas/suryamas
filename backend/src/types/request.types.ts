import { Request } from 'express'

export interface AuthUser {
  id: string
  email: string
  employee_id: string
  role?: string
}

export interface PaginationParams {
  page: number
  limit: number
}

export interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

export interface QueryFilter {
  [key: string]: any
}

// Base authenticated request
export interface AuthenticatedRequest extends Request {
  user: AuthUser
}

// Authenticated request with pagination
export interface AuthenticatedPaginatedRequest extends AuthenticatedRequest {
  pagination: PaginationParams
}

// Authenticated request with sort
export interface AuthenticatedSortedRequest extends AuthenticatedRequest {
  sort?: SortParams
}

// Authenticated request with query filter
export interface AuthenticatedFilteredRequest extends AuthenticatedRequest {
  queryFilter?: QueryFilter
}

// Authenticated request with pagination + sort + filter
export interface AuthenticatedQueryRequest extends AuthenticatedRequest {
  pagination: PaginationParams
  sort?: SortParams
  queryFilter?: QueryFilter
}
