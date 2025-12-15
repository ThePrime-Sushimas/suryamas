// =====================================================
// PERMISSIONS CONTROLLER
// =====================================================

import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { PermissionsService } from './permissions.service'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class PermissionsController {
  private service: PermissionsService
  private static modulesCache: any[] | null = null
  private static rolesCacheMap = new Map<string, any>()
  private static readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes
  private static modulesCacheExpiry = 0
  private static rolesCacheExpiry = 0

  constructor() {
    this.service = new PermissionsService()
  }

  // =====================================================
  // MODULES
  // =====================================================

  getAllModules = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (PermissionsController.modulesCache && PermissionsController.modulesCacheExpiry > Date.now()) {
        sendSuccess(res, PermissionsController.modulesCache, 'Modules retrieved successfully')
        return
      }
      const modules = await this.service.getAllModules()
      PermissionsController.modulesCache = modules
      PermissionsController.modulesCacheExpiry = Date.now() + PermissionsController.CACHE_TTL
      sendSuccess(res, modules, 'Modules retrieved successfully')
    } catch (error: any) {
      logError('Get modules failed', { error: error.message })
      sendError(res, 'Failed to retrieve modules', 500)
    }
  }

  getModuleById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const module = await this.service.getModuleById(id)

      if (!module) {
        sendError(res, 'Module not found', 404)
        return
      }

      sendSuccess(res, module, 'Module retrieved successfully')
    } catch (error: any) {
      logError('Get module failed', { error: error.message })
      sendError(res, 'Failed to retrieve module', 500)
    }
  }

  createModule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const module = await this.service.createModule(req.body, req.user?.id)
      // Clear controller cache
      PermissionsController.modulesCache = null
      // Clear core permission cache
      await CorePermissionService.invalidateAllCache()
      sendSuccess(res, module, 'Module created successfully', 201)
    } catch (error: any) {
      logError('Create module failed', { error: error.message })
      sendError(res, error.message || 'Failed to create module', 400)
    }
  }

  updateModule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const module = await this.service.updateModule(id, req.body)
      // Clear controller cache
      PermissionsController.modulesCache = null
      // Clear core permission cache
      await CorePermissionService.invalidateAllCache()
      sendSuccess(res, module, 'Module updated successfully')
    } catch (error: any) {
      logError('Update module failed', { error: error.message })
      sendError(res, 'Failed to update module', 500)
    }
  }

  deleteModule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const success = await this.service.deleteModule(id)

      if (!success) {
        sendError(res, 'Failed to delete module', 400)
        return
      }

      PermissionsController.modulesCache = null
      sendSuccess(res, null, 'Module deleted successfully')
    } catch (error: any) {
      logError('Delete module failed', { error: error.message })
      sendError(res, 'Failed to delete module', 500)
    }
  }

  // =====================================================
  // ROLES
  // =====================================================

  getAllRoles = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const cacheKey = 'all_roles'
      const cached = PermissionsController.rolesCacheMap.get(cacheKey)
      if (cached && PermissionsController.rolesCacheExpiry > Date.now()) {
        sendSuccess(res, cached, 'Roles retrieved successfully')
        return
      }
      const roles = await this.service.getAllRoles()
      PermissionsController.rolesCacheMap.set(cacheKey, roles)
      PermissionsController.rolesCacheExpiry = Date.now() + PermissionsController.CACHE_TTL
      sendSuccess(res, roles, 'Roles retrieved successfully')
    } catch (error: any) {
      logError('Get roles failed', { error: error.message })
      sendError(res, 'Failed to retrieve roles', 500)
    }
  }

  getRoleById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const cached = PermissionsController.rolesCacheMap.get(id)
      if (cached && PermissionsController.rolesCacheExpiry > Date.now()) {
        sendSuccess(res, cached, 'Role retrieved successfully')
        return
      }
      const role = await this.service.getRoleById(id)

      if (!role) {
        sendError(res, 'Role not found', 404)
        return
      }

      PermissionsController.rolesCacheMap.set(id, role)
      PermissionsController.rolesCacheExpiry = Date.now() + PermissionsController.CACHE_TTL
      sendSuccess(res, role, 'Role retrieved successfully')
    } catch (error: any) {
      logError('Get role failed', { error: error.message })
      sendError(res, 'Failed to retrieve role', 500)
    }
  }

  createRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const role = await this.service.createRole(req.body, req.user?.id)
      // Clear controller cache
      PermissionsController.rolesCacheMap.delete('all_roles')
      // Clear core permission cache
      await CorePermissionService.invalidateAllCache()
      sendSuccess(res, role, 'Role created successfully', 201)
    } catch (error: any) {
      logError('Create role failed', { error: error.message })
      sendError(res, error.message || 'Failed to create role', 400)
    }
  }

  updateRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const role = await this.service.updateRole(id, req.body)
      // Clear controller cache
      PermissionsController.rolesCacheMap.delete(id)
      PermissionsController.rolesCacheMap.delete('all_roles')
      // Clear core permission cache
      await CorePermissionService.invalidateAllCache()
      sendSuccess(res, role, 'Role updated successfully')
    } catch (error: any) {
      logError('Update role failed', { error: error.message })
      sendError(res, 'Failed to update role', 500)
    }
  }

  deleteRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const success = await this.service.deleteRole(id, req.user?.id)

      if (!success) {
        sendError(res, 'Failed to delete role', 400)
        return
      }

      PermissionsController.rolesCacheMap.delete(id)
      PermissionsController.rolesCacheMap.delete('all_roles')
      sendSuccess(res, null, 'Role deleted successfully')
    } catch (error: any) {
      logError('Delete role failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete role', 500)
    }
  }

  // =====================================================
  // ROLE PERMISSIONS
  // =====================================================

  getRolePermissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roleId } = req.params
      const permissions = await this.service.getRolePermissions(roleId)
      sendSuccess(res, permissions, 'Role permissions retrieved successfully')
    } catch (error: any) {
      logError('Get role permissions failed', { error: error.message })
      sendError(res, 'Failed to retrieve role permissions', 500)
    }
  }

  updateRolePermission = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roleId, moduleId } = req.params
      const permission = await this.service.updateRolePermission(
        roleId,
        moduleId,
        req.body,
        req.user?.id
      )
      // Clear controller cache
      PermissionsController.rolesCacheMap.delete(roleId)
      PermissionsController.rolesCacheMap.delete('all_roles')
      sendSuccess(res, permission, 'Role permission updated successfully')
    } catch (error: any) {
      logError('Update role permission failed', { error: error.message })
      sendError(res, 'Failed to update role permission', 500)
    }
  }

  bulkUpdateRolePermissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roleId } = req.params
      const { updates } = req.body // Array of { moduleId, permissions }

      await CorePermissionService.bulkUpdateRolePermissions(roleId, updates, req.user?.id)
      // Clear controller cache
      PermissionsController.rolesCacheMap.delete(roleId)
      PermissionsController.rolesCacheMap.delete('all_roles')
      sendSuccess(res, null, 'Role permissions updated successfully')
    } catch (error: any) {
      logError('Bulk update role permissions failed', { error: error.message })
      sendError(res, 'Failed to update role permissions', 500)
    }
  }

  // =====================================================
  // SEED
  // =====================================================

  seedDefaults = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await this.service.seedDefaults()
      sendSuccess(res, result, 'Default permissions seeded successfully')
    } catch (error: any) {
      logError('Seed defaults failed', { error: error.message })
      sendError(res, 'Failed to seed default permissions', 500)
    }
  }
}
