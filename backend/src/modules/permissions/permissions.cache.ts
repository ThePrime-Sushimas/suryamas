// =====================================================
// PERMISSIONS CACHE
// Responsibility: In-memory caching with TTL
// =====================================================

import type { Module, Role } from './permissions.types'

interface CacheEntry<T> {
  data: T
  expiry: number
}

export class PermissionsCache {
  private static readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes
  private static modulesCache: CacheEntry<Module[]> | null = null
  private static rolesCacheMap = new Map<string, CacheEntry<any>>()
  private static pendingModules: Promise<Module[]> | null = null

  // Modules cache with debouncing
  static getModules(): Module[] | null {
    if (this.modulesCache && this.modulesCache.expiry > Date.now()) {
      return this.modulesCache.data
    }
    this.modulesCache = null
    return null
  }

  static setModules(modules: Module[]): void {
    this.modulesCache = {
      data: modules,
      expiry: Date.now() + this.CACHE_TTL
    }
    this.pendingModules = null
  }

  static invalidateModules(): void {
    this.modulesCache = null
    this.pendingModules = null
  }

  static setPendingModules(promise: Promise<Module[]>): void {
    this.pendingModules = promise
  }

  static getPendingModules(): Promise<Module[]> | null {
    return this.pendingModules
  }

  // Roles cache with individual expiry
  static getRole(key: string): any | null {
    const cached = this.rolesCacheMap.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.data
    }
    this.rolesCacheMap.delete(key)
    return null
  }

  static setRole(key: string, role: any): void {
    this.rolesCacheMap.set(key, {
      data: role,
      expiry: Date.now() + this.CACHE_TTL
    })
  }

  static invalidateRole(key: string): void {
    this.rolesCacheMap.delete(key)
  }

  static invalidateAllRoles(): void {
    this.rolesCacheMap.clear()
  }
}
