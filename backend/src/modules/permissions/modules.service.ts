// =====================================================
// MODULES SERVICE
// Responsibility: Module business logic & orchestration
// =====================================================

import { ModulesRepository } from './modules.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { PermissionsCache } from './permissions.cache'
import { logError } from '../../config/logger'
import { OperationalError } from './permissions.errors'
import type { CreateModuleDto } from './permissions.types'

export class ModulesService {
  private repository: ModulesRepository

  constructor() {
    this.repository = new ModulesRepository()
  }

  async getAll() {
    const cached = PermissionsCache.getModules()
    if (cached) return cached

    // Check if there's already a pending request
    const pending = PermissionsCache.getPendingModules()
    if (pending) return pending

    // Create new request and cache it
    const promise = this.repository.getAll()
    PermissionsCache.setPendingModules(promise)

    const modules = await promise
    PermissionsCache.setModules(modules)
    return modules
  }

  async findById(id: string) {
    return await this.repository.findById(id)
  }

  async create(dto: CreateModuleDto, createdBy?: string) {
    try {
      const module = await CorePermissionService.registerModule(
        dto.name ?? '',
        dto.description ?? ''
      )
      if (!module) {
        throw new OperationalError('Failed to create module', 500)
      }
      PermissionsCache.invalidateModules()
      await CorePermissionService.invalidateAllCache()
      return module
    } catch (error: any) {
      logError('Failed to create module', { error: error.message })
      if (error instanceof OperationalError) throw error
      throw new OperationalError(error.message || 'Failed to create module', 500)
    }
  }

  async update(id: string, updates: Partial<CreateModuleDto>) {
    const module = await this.repository.update(id, updates)
    PermissionsCache.invalidateModules()
    await CorePermissionService.invalidateAllCache()
    return module
  }

  async delete(id: string) {
    const success = await this.repository.delete(id)
    if (success) {
      PermissionsCache.invalidateModules()
      await CorePermissionService.invalidateAllCache()
    }
    return success
  }
}
