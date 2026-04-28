import { Response, NextFunction } from 'express'
import { AuthRequest, BranchContext } from '../types/common.types'
import { pool } from '../config/db'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'

const branchContextCache = new Map<string, { context: BranchContext; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
      const { rows } = await pool.query(
        `SELECT eb.*, b.id AS b_id, b.branch_name, b.company_id
         FROM employee_branches eb
         JOIN branches b ON b.id = eb.branch_id
         JOIN employees e ON e.id = eb.employee_id
         WHERE e.user_id = $1 AND eb.is_primary = true AND eb.status = 'active'
         LIMIT 1`,
        [req.user.id]
      )

      if (rows.length === 0) {
        logWarn('No active primary branch', { user_id: req.user.id })
        sendError(res, 'No active branch assignment', 403)
        return
      }

      const primary = rows[0]
      req.context = {
        company_id: primary.company_id,
        branch_id: primary.branch_id,
        branch_name: primary.branch_name,
        employee_id: primary.employee_id,
        role_id: primary.role_id,
        approval_limit: primary.approval_limit,
      }
    } else {
      const cacheKey = `${req.user.id}:${branchId}`
      const cached = branchContextCache.get(cacheKey)

      if (cached && cached.expiresAt > Date.now()) {
        req.context = cached.context
      } else {
        const { rows } = await pool.query(
          `SELECT eb.*, b.id AS b_id, b.branch_name, b.company_id
           FROM employee_branches eb
           JOIN branches b ON b.id = eb.branch_id
           JOIN employees e ON e.id = eb.employee_id
           WHERE e.user_id = $1 AND eb.branch_id = $2 AND eb.status = 'active'
           LIMIT 1`,
          [req.user.id, branchId]
        )

        if (rows.length === 0) {
          logWarn('Branch access denied', { user_id: req.user.id, branch_id: branchId })
          sendError(res, 'No access to this branch', 403)
          return
        }

        const assignment = rows[0]
        req.context = {
          company_id: assignment.company_id,
          branch_id: assignment.branch_id,
          branch_name: assignment.branch_name,
          employee_id: assignment.employee_id,
          role_id: assignment.role_id,
          approval_limit: assignment.approval_limit,
        }

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

export const invalidateBranchContextCache = (userId: string, branchId?: string): void => {
  if (branchId) {
    branchContextCache.delete(`${userId}:${branchId}`)
  } else {
    for (const key of branchContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        branchContextCache.delete(key)
      }
    }
  }
}
