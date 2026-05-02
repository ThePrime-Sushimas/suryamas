import { Response, NextFunction } from 'express'
import { AuthRequest, BranchContext } from '../types/common.types'
import { pool } from '../config/db'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'

const branchContextCache = new Map<string, { context: BranchContext; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Shared query: join employee_branches + branches + employees
// Allow active AND closed branches (closed = read-only access)
// Reject inactive branches (no access at all)
const BRANCH_CONTEXT_QUERY_PRIMARY = `
  SELECT eb.*, b.id AS b_id, b.branch_name, b.company_id, b.status AS branch_status
  FROM employee_branches eb
  JOIN branches b ON b.id = eb.branch_id
  JOIN employees e ON e.id = eb.employee_id
  WHERE e.user_id = $1
    AND eb.is_primary = true
    AND eb.status = 'active'
    AND b.status IN ('active', 'closed')
  LIMIT 1`

const BRANCH_CONTEXT_QUERY_EXPLICIT = `
  SELECT eb.*, b.id AS b_id, b.branch_name, b.company_id, b.status AS branch_status
  FROM employee_branches eb
  JOIN branches b ON b.id = eb.branch_id
  JOIN employees e ON e.id = eb.employee_id
  WHERE e.user_id = $1
    AND eb.branch_id = $2
    AND eb.status = 'active'
    AND b.status IN ('active', 'closed')
  LIMIT 1`

function buildContext(row: Record<string, unknown>): BranchContext {
  return {
    company_id: row.company_id as string,
    branch_id: row.branch_id as string,
    branch_name: row.branch_name as string,
    employee_id: row.employee_id as string,
    role_id: row.role_id as string,
    approval_limit: row.approval_limit as number,
    is_read_only: row.branch_status === 'closed',
    branch_status: row.branch_status as string,
  }
}

export const resolveBranchContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      sendError(res, 'Authentication required', 401)
      return
    }

    const branchId = req.headers['x-branch-id'] as string

    if (!branchId) {
      const { rows } = await pool.query(BRANCH_CONTEXT_QUERY_PRIMARY, [req.user.id])

      if (rows.length === 0) {
        logWarn('No active primary branch', { user_id: req.user.id })
        sendError(res, 'No active branch assignment', 403)
        return
      }

      req.context = buildContext(rows[0])
    } else {
      const cacheKey = `${req.user.id}:${branchId}`
      const cached = branchContextCache.get(cacheKey)

      if (cached && cached.expiresAt > Date.now()) {
        req.context = cached.context
      } else {
        const { rows } = await pool.query(BRANCH_CONTEXT_QUERY_EXPLICIT, [req.user.id, branchId])

        if (rows.length === 0) {
          logWarn('Branch access denied', { user_id: req.user.id, branch_id: branchId })
          sendError(res, 'No access to this branch', 403)
          return
        }

        req.context = buildContext(rows[0])

        branchContextCache.set(cacheKey, {
          context: req.context,
          expiresAt: Date.now() + CACHE_TTL,
        })
      }
    }

    const PermissionService = require('../services/permission.service').PermissionService
    req.permissions = await PermissionService.getUserPermissionsByRole(req.context.role_id)

    next()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    logWarn('Branch context resolution failed', { user_id: req.user?.id, error: msg })
    sendError(res, 'Failed to resolve branch context', 500)
  }
}

/**
 * Invalidate branch context cache.
 * - userId + branchId: invalidate specific entry
 * - userId only: invalidate all branches for user
 * - branchId only: invalidate all users for branch (used when closing a branch)
 */
export const invalidateBranchContextCache = (userId?: string, branchId?: string): void => {
  if (userId && branchId) {
    branchContextCache.delete(`${userId}:${branchId}`)
  } else if (userId) {
    for (const key of branchContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) branchContextCache.delete(key)
    }
  } else if (branchId) {
    for (const key of branchContextCache.keys()) {
      if (key.endsWith(`:${branchId}`)) branchContextCache.delete(key)
    }
  }
}
