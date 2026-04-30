import type { PermissionMatrix } from '../modules/permissions/permissions.types'
import type { BranchContext } from './common.types'
import type { AuthUser, PaginationParams, QueryFilter } from './request.types'

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      permissions?: PermissionMatrix
      context?: BranchContext
      pagination?: PaginationParams
      sort?: {
        field: string
        order: 'asc' | 'desc'
      }
      filterParams?: QueryFilter
      queryFilter?: QueryFilter
      validated?: unknown
    }
  }
}
