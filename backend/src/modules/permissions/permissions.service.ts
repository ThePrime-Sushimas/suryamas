// =====================================================
// PERMISSIONS SERVICE (FIXED VERSION)
// =====================================================

import { PermissionsRepository } from './permissions.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { AuditService } from '../../services/audit.service'
import { logInfo, logError } from '../../config/logger'
import type {
  CreateModuleDto,
  CreateRoleDto,
  UpdateRolePermissionsDto,
} from '../../types/permission.types'
import { createDefaultPermissions } from '../../utils/permissions.util'

export class PermissionsService {
  private repository: PermissionsRepository

  constructor() {
    this.repository = new PermissionsRepository()
  }

  // =====================================================
  // MODULES
  // =====================================================

  async getAllModules() {
    return await this.repository.getAllModules()
  }

  async getModuleById(id: string) {
    return await this.repository.getModuleById(id)
  }

  async createModule(dto: CreateModuleDto, createdBy?: string) {
    try {
      // Delegate to CorePermissionService for consistency

      const module = await CorePermissionService.registerModule(
        dto.name ?? "",
        dto.description ?? ""
      );
      if (!module) {
        throw new Error('Failed to create module')
      }
      return module
    } catch (error: any) {
      logError('Failed to create module', { error: error.message })
      throw error
    }
  }

  async updateModule(id: string, updates: Partial<CreateModuleDto>) {
    return await this.repository.updateModule(id, updates)
  }

  async deleteModule(id: string) {
    return await this.repository.deleteModule(id)
  }

  // =====================================================
  // ROLES
  // =====================================================

  async getAllRoles() {
    return await this.repository.getAllRoles()
  }

  async getRoleById(id: string) {
    return await this.repository.getRoleById(id)
  }

  async createRole(dto: CreateRoleDto, createdBy?: string) {
    try {
      // Check if exists
      const existing = await this.repository.getRoleByName(dto.name)
      if (existing) {
        throw new Error('Role already exists')
      }

      // Create role
      const role = await this.repository.createRole(dto)

      // Create default permissions for all modules
      const modules = await this.repository.getAllModules()
      const permissions = modules.map((module) => ({
        role_id: role.id,
        module_id: module.id,
        ...createDefaultPermissions(dto.name),
      }))

      for (const perm of permissions) {
        await this.repository.createPermission(perm)
      }

      if (createdBy) {
        await AuditService.log(
          'CREATE',
          'role',
          role.id,
          createdBy,
          null,
          role
        )
      }

      logInfo('Role created with default permissions', {
        roleId: role.id,
        name: dto.name,
        moduleCount: modules.length,
      })

      return role
    } catch (error: any) {
      logError('Failed to create role', { error: error.message })
      throw error
    }
  }

  async updateRole(id: string, updates: Partial<CreateRoleDto>) {
    return await this.repository.updateRole(id, updates)
  }

  async deleteRole(id: string, deletedBy?: string) {
    const role = await this.repository.getRoleById(id)
    const result = await this.repository.deleteRole(id)

    if (result && role && deletedBy) {
      await AuditService.log(
        'DELETE',
        'role',
        id,
        deletedBy,
        role,
        null
      )
    }

    return result
  }

  // =====================================================
  // ROLE PERMISSIONS
  // =====================================================

  async getRolePermissions(roleId: string) {
    return await this.repository.getRolePermissions(roleId)
  }

  async updateRolePermission(
    roleId: string,
    moduleId: string,
    permissions: UpdateRolePermissionsDto,
    changedBy?: string
  ) {
    try {
      // Delegate to CorePermissionService for consistency
      const result = await CorePermissionService.updateRolePermissions(
        roleId,
        moduleId,
        permissions,
        changedBy
      )
      return result
    } catch (error: any) {
      logError('Failed to update role permission', { error: error.message })
      throw error
    }
  }



  // =====================================================
  // SEED DEFAULT DATA
  // =====================================================

  async seedDefaults() {
    try {
      logInfo('Starting permission seed...')

      // Create default roles
      const defaultRoles = [
        { name: 'admin', description: 'System Administrator', is_system_role: true },
        { name: 'manager', description: 'Manager', is_system_role: true },
        { name: 'staff', description: 'Staff Member', is_system_role: true },
      ]

      for (const roleData of defaultRoles) {
        const existing = await this.repository.getRoleByName(roleData.name)
        if (!existing) {
          await this.repository.createRole(roleData)
          logInfo('Default role created', { role: roleData.name })
        }
      }

      // Register default modules
      const defaultModules = [
        { name: 'employees', description: 'Employee Management' },
        { name: 'permissions', description: 'Permission Management' },
      ]

      for (const moduleData of defaultModules) {
        await CorePermissionService.registerModule(moduleData.name, moduleData.description)
      }

      logInfo('Permission seed completed')
      return { success: true, message: 'Default permissions seeded successfully' }
    } catch (error: any) {
      logError('Permission seed failed', { error: error.message })
      throw error
    }
  }
}