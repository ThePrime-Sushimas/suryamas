// =====================================================
// ROLES SERVICE
// Responsibility: Role business logic & orchestration
// =====================================================

import { RolesRepository } from './roles.repository'
import { ModulesRepository } from './modules.repository'
import { RolePermissionsRepository } from './role-permissions.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { AuditService } from '../../services/audit.service'
import { PermissionsCache } from './permissions.cache'
import { logInfo, logError } from '../../config/logger'
import { createDefaultPermissions } from '../../utils/permissions.util'
import { ConflictError, OperationalError } from './permissions.errors'
import type { CreateRoleDto } from './permissions.types'

export class RolesService {
  private repository: RolesRepository
  private modulesRepo: ModulesRepository
  private permissionsRepo: RolePermissionsRepository

  constructor() {
    this.repository = new RolesRepository()
    this.modulesRepo = new ModulesRepository()
    this.permissionsRepo = new RolePermissionsRepository()
  }

  async getAll() {
    const cached = PermissionsCache.getRole('all_roles')
    if (cached) return cached

    const roles = await this.repository.getAll()
    PermissionsCache.setRole('all_roles', roles)
    return roles
  }

  async getById(id: string) {
    const cached = PermissionsCache.getRole(id)
    if (cached) return cached

    const role = await this.repository.getById(id)
    if (role) {
      PermissionsCache.setRole(id, role)
    }
    return role
  }

  async create(dto: CreateRoleDto, createdBy?: string) {
    try {
      const existing = await this.repository.getByName(dto.name)
      if (existing) {
        throw new ConflictError('Role already exists')
      }

      const role = await this.repository.create(dto)

      const modules = await this.modulesRepo.getAll()
      const permissions = modules.map((module) => ({
        role_id: role.id,
        module_id: module.id,
        ...createDefaultPermissions(dto.name),
      }))

      // Use bulk insert to avoid N+1 query
      const success = await this.permissionsRepo.bulkCreate(permissions)
      if (!success) {
        throw new OperationalError('Failed to create default permissions', 500)
      }

      if (createdBy) {
        await AuditService.log('CREATE', 'role', role.id, createdBy, null, role)
      }

      PermissionsCache.invalidateRole('all_roles')
      await CorePermissionService.invalidateAllCache()

      logInfo('Role created with default permissions', {
        roleId: role.id,
        name: dto.name,
        moduleCount: modules.length,
      })

      return role
    } catch (error: any) {
      logError('Failed to create role', { error: error.message })
      if (error instanceof OperationalError) throw error
      throw new OperationalError(error.message || 'Failed to create role', 500)
    }
  }

  async update(id: string, updates: Partial<CreateRoleDto>) {
    const role = await this.repository.update(id, updates)
    PermissionsCache.invalidateRole(id)
    PermissionsCache.invalidateRole('all_roles')
    await CorePermissionService.invalidateAllCache()
    return role
  }

  async delete(id: string, deletedBy?: string) {
    const role = await this.repository.getById(id)
    const result = await this.repository.delete(id)

    if (result && role && deletedBy) {
      await AuditService.log('DELETE', 'role', id, deletedBy, role, null)
    }

    if (result) {
      PermissionsCache.invalidateRole(id)
      PermissionsCache.invalidateRole('all_roles')
    }

    return result
  }
}
