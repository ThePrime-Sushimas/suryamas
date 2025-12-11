// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/common.types'
import type { PermissionAction } from '../types/permission.types'
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

      // Check permission
      const result = await PermissionService.hasPermission(req.user.id, moduleName, action)

      if (!result.allowed) {
        logWarn('Permission denied', {
          userId: req.user.id,
          module: moduleName,
          action,
          path: req.path,
          reason: result.reason,
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

      // Check all permissions
      const checks = actions.map((action) => ({ module: moduleName, action }))
      const results = await PermissionService.hasPermissions(req.user.id, checks)

      // All must be true
      const allAllowed = Object.values(results).every((allowed) => allowed)

      if (!allAllowed) {
        logWarn('Multiple permissions denied', {
          userId: req.user.id,
          module: moduleName,
          actions,
          results,
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

      // Check all permissions
      const checks = actions.map((action) => ({ module: moduleName, action }))
      const results = await PermissionService.hasPermissions(req.user.id, checks)

      // At least one must be true
      const anyAllowed = Object.values(results).some((allowed) => allowed)

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

/**
 * Middleware: Admin only (checks if user has admin role)
 */
export const adminOnly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      sendError(res, 'Authentication required', 401)
      return
    }

    // Check if user has admin role
    const { supabase } = await import('../config/supabase')
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('perm_user_profiles')
      .select('role_id')
      .eq('user_id', req.user.id)
      .single()

    if (profileError || !profile) {
      logWarn('Admin check: User profile not found', { userId: req.user.id, error: profileError?.message })
      sendError(res, 'Failed to verify admin status', 500)
      return
    }

    // Get role name
    const { data: role, error: roleError } = await supabase
      .from('perm_roles')
      .select('name')
      .eq('id', profile.role_id)
      .single()

    if (roleError || !role) {
      logWarn('Admin check: Role not found', { roleId: profile.role_id, error: roleError?.message })
      sendError(res, 'Failed to verify admin status', 500)
      return
    }

    const roleName = role.name

    if (roleName !== 'admin') {
      logWarn('Admin access denied', {
        userId: req.user.id,
        role: roleName,
        path: req.path,
      })
      sendError(res, 'Admin access required', 403)
      return
    }

    next()
  } catch (error: any) {
    logWarn('Admin check error', { error: error.message })
    sendError(res, 'Admin verification failed', 500)
  }
}
