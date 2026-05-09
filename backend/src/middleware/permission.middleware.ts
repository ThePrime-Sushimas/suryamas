// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/common.types'
import type { PermissionAction } from '../modules/permissions/permissions.types'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'
import { isPublicModule } from '../utils/permissions.util'

/**
 * Shared helper for permission logic
 */
async function validateAccess(
  req: AuthRequest,
  res: Response,
  moduleName: string,
  check: (permissions: any) => boolean,
  onDenied: () => void
): Promise<boolean> {
  // Skip if public module
  if (isPublicModule(moduleName)) {
    return true
  }

  // User must be authenticated
  if (!req.user?.id) {
    logWarn('Permission check failed: No user', {
      module: moduleName,
      path: req.path,
    })
    sendError(res, 'Authentication required', 401)
    return false
  }

  // Check permissions matrix
  const allowed = check(req.permissions?.[moduleName] || {})

  if (!allowed) {
    onDenied()
    return false
  }

  return true
}

/**
 * Generic permission checker middleware factory
 */
function checkPermission(moduleName: string, action: PermissionAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAllowed = await validateAccess(
        req,
        res,
        moduleName,
        (p) => !!p[action],
        () => {
          logWarn('Permission denied', {
            userId: req.user?.id,
            module: moduleName,
            action,
            path: req.path,
          })
          sendError(res, `You don't have permission to ${action} ${moduleName}`, 403)
        }
      )

      if (isAllowed) next()
    } catch (error: any) {
      logWarn('Permission check error', {
        module: moduleName,
        action,
        error: error.message,
      })
      sendError(res, 'Permission check failed', 500)
    }
  }
}

/**
 * Middleware: Check VIEW permission
 */
export const canView = (moduleName: string) => checkPermission(moduleName, 'view')

/**
 * Middleware: Check INSERT permission
 */
export const canInsert = (moduleName: string) => checkPermission(moduleName, 'insert')

/**
 * Middleware: Check UPDATE permission
 */
export const canUpdate = (moduleName: string) => checkPermission(moduleName, 'update')

/**
 * Middleware: Check DELETE permission
 */
export const canDelete = (moduleName: string) => checkPermission(moduleName, 'delete')

/**
 * Middleware: Check APPROVE permission
 */
export const canApprove = (moduleName: string) => checkPermission(moduleName, 'approve')

/**
 * Middleware: Check RELEASE permission
 */
export const canRelease = (moduleName: string) => checkPermission(moduleName, 'release')

/**
 * Middleware: Check multiple permissions (user must have ALL)
 */
export function requirePermissions(
  moduleName: string,
  actions: PermissionAction[]
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAllowed = await validateAccess(
        req,
        res,
        moduleName,
        (p) => actions.every((action) => !!p[action]),
        () => {
          logWarn('Multiple permissions denied', {
            userId: req.user?.id,
            module: moduleName,
            actions,
          })
          sendError(res, `Insufficient permissions for ${moduleName}`, 403)
        }
      )

      if (isAllowed) next()
    } catch (error: any) {
      logWarn('Permission check error', {
        module: moduleName,
        actions,
        error: error.message,
      })
      sendError(res, 'Permission check failed', 500)
    }
  }
}

/**
 * Middleware: Check if user has ANY of the specified permissions
 */
export function requireAnyPermission(
  moduleName: string,
  actions: PermissionAction[]
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAllowed = await validateAccess(
        req,
        res,
        moduleName,
        (p) => actions.some((action) => !!p[action]),
        () => {
          logWarn('No permissions matched', {
            userId: req.user?.id,
            module: moduleName,
            actions,
          })
          sendError(res, `Insufficient permissions for ${moduleName}`, 403)
        }
      )

      if (isAllowed) next()
    } catch (error: any) {
      logWarn('Permission check error', {
        module: moduleName,
        actions,
        error: error.message,
      })
      sendError(res, 'Permission check failed', 500)
    }
  }
}

