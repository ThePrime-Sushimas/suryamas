// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/common.types'
import type { PermissionAction } from '../modules/permissions/permissions.types'
import { PermissionService } from '../services/permission.service'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'
import { isPublicModule } from '../utils/permissions.util'

/**
 * Generic permission checker middleware factory
 */
function checkPermission(moduleName: string, action: PermissionAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip if public module
      if (isPublicModule(moduleName)) {
        return next()
      }

      // User must be authenticated
      if (!req.user?.id) {
        logWarn('Permission check failed: No user', {
          module: moduleName,
          action,
          path: req.path,
        })
        sendError(res, 'Authentication required', 401)
        return
      }

      // Check from preloaded permissions (no RPC)
      const allowed = req.permissions?.[moduleName]?.[action] || false

      if (!allowed) {
        logWarn('Permission denied', {
          userId: req.user.id,
          module: moduleName,
          action,
          path: req.path,
        })
        sendError(
          res,
          `You don't have permission to ${action} ${moduleName}`,
          403
        )
        return
      }

      // Permission granted
      next()
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
      if (isPublicModule(moduleName)) {
        return next()
      }

      if (!req.user?.id) {
        sendError(res, 'Authentication required', 401)
        return
      }

      // Check all permissions from preloaded matrix
      const allAllowed = actions.every((action) => req.permissions?.[moduleName]?.[action])

      if (!allAllowed) {
        logWarn('Multiple permissions denied', {
          userId: req.user.id,
          module: moduleName,
          actions,
        })
        sendError(res, `Insufficient permissions for ${moduleName}`, 403)
        return
      }

      next()
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
      if (isPublicModule(moduleName)) {
        return next()
      }

      if (!req.user?.id) {
        sendError(res, 'Authentication required', 401)
        return
      }

      // Check any permission from preloaded matrix
      const anyAllowed = actions.some((action) => req.permissions?.[moduleName]?.[action])

      if (!anyAllowed) {
        logWarn('No permissions matched', {
          userId: req.user.id,
          module: moduleName,
          actions,
        })
        sendError(res, `Insufficient permissions for ${moduleName}`, 403)
        return
      }

      next()
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

