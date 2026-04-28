import { pool } from '../config/db'
import { logError } from '../config/logger'
import type {
  Module,
  Role,
  RolePermission,
  PermissionAction,
  PermissionMatrix,
  PermissionCheckResult,
  UpdateRolePermissionsDto,
} from '../modules/permissions/permissions.types'
import {
  isPublicModule,
  createDefaultPermissions,
  PERMISSION_CACHE_TTL,
} from '../utils/permissions.util'

export class PermissionService {
  private static memoryCache = new Map<string, { permissions: PermissionMatrix; expiresAt: number }>()
  private static userPermissionsCache = new Map<string, { permissions: PermissionMatrix; expiresAt: number }>()
  private static readonly MEMORY_CACHE_TTL = 5 * 60 * 1000
  private static readonly USER_PERMISSIONS_CACHE_TTL = 10 * 60 * 1000

  static async registerModule(name: string, description: string, defaultPermissions?: Record<string, Record<string, boolean>>): Promise<Module | null> {
    try {
      const { rows: existing } = await pool.query('SELECT * FROM perm_modules WHERE name = $1', [name])
      if (existing.length > 0) return existing[0] as Module

      const { rows: created } = await pool.query(
        'INSERT INTO perm_modules (name, description, is_active) VALUES ($1, $2, true) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
        [name, description]
      )
      const mod = created[0] as Module

      const { rows: roles } = await pool.query('SELECT * FROM perm_roles')
      if (roles.length > 0) {
        const values: string[] = []
        const params: (string | boolean)[] = []
        let idx = 1
        for (const role of roles) {
          const defaults = defaultPermissions?.[role.name] || createDefaultPermissions(role.name)
          values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7})`)
          params.push(role.id, mod.id, defaults.can_view ?? false, defaults.can_insert ?? false, defaults.can_update ?? false, defaults.can_delete ?? false, defaults.can_approve ?? false, defaults.can_release ?? false)
          idx += 8
        }
        await pool.query(
          `INSERT INTO perm_role_permissions (role_id, module_id, can_view, can_insert, can_update, can_delete, can_approve, can_release) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
          params
        ).catch(e => logError('Failed to create default permissions', { error: e.message }))
      }

      return mod
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Module registration failed', { module: name, error: msg })
      return null
    }
  }

  static async getAllModules(): Promise<Module[]> {
    const { rows } = await pool.query('SELECT * FROM perm_modules ORDER BY name')
    return rows as Module[]
  }

  static async updateModuleStatus(moduleId: string, isActive: boolean): Promise<boolean> {
    const { rowCount } = await pool.query('UPDATE perm_modules SET is_active = $1 WHERE id = $2', [isActive, moduleId])
    if ((rowCount ?? 0) > 0) await this.invalidateAllCache()
    return (rowCount ?? 0) > 0
  }

  static async hasPermission(userId: string, moduleName: string, action: PermissionAction): Promise<PermissionCheckResult> {
    try {
      if (isPublicModule(moduleName)) return { allowed: true, reason: 'Public module' }

      const memCached = this.memoryCache.get(userId)
      if (memCached && memCached.expiresAt > Date.now()) {
        return { allowed: memCached.permissions[moduleName]?.[action] || false, cached: true }
      }

      const cached = await this.getFromCache(userId)
      if (cached && Object.keys(cached).length > 0) {
        this.memoryCache.set(userId, { permissions: cached, expiresAt: Date.now() + this.MEMORY_CACHE_TTL })
        return { allowed: cached[moduleName]?.[action] || false, cached: true }
      }

      await this.updateCache(userId)
      const perms = this.memoryCache.get(userId)?.permissions || {}
      return { allowed: perms[moduleName]?.[action] || false, cached: false }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Permission check failed', { userId, moduleName, action, error: msg })
      return { allowed: false, reason: 'Permission check error' }
    }
  }

  static async getUserPermissions(userId: string): Promise<PermissionMatrix> {
    try {
      const cached = this.userPermissionsCache.get(userId)
      if (cached && cached.expiresAt > Date.now()) return cached.permissions

      const { rows } = await pool.query('SELECT role_id FROM perm_user_profiles WHERE user_id = $1', [userId])
      if (rows.length === 0) return {}

      return await this.getUserPermissionsByRole(rows[0].role_id)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Failed to get user permissions', { userId, error: msg })
      return {}
    }
  }

  static async getUserPermissionsByRole(roleId: string): Promise<PermissionMatrix> {
    try {
      const { rows } = await pool.query(
        `SELECT rp.can_view, rp.can_insert, rp.can_update, rp.can_delete, rp.can_approve, rp.can_release, m.name AS module_name
         FROM perm_role_permissions rp
         JOIN perm_modules m ON m.id = rp.module_id
         WHERE rp.role_id = $1`,
        [roleId]
      )

      const matrix: PermissionMatrix = {}
      for (const row of rows) {
        matrix[row.module_name] = {
          view: row.can_view,
          insert: row.can_insert,
          update: row.can_update,
          delete: row.can_delete,
          approve: row.can_approve,
          release: row.can_release,
        }
      }
      return matrix
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Failed to get permissions by role', { roleId, error: msg })
      return {}
    }
  }

  static async getAllRoles(): Promise<Role[]> {
    const { rows } = await pool.query('SELECT * FROM perm_roles ORDER BY name')
    return rows as Role[]
  }

  static async getRoleWithPermissions(roleId: string) {
    const { rows: roleRows } = await pool.query('SELECT * FROM perm_roles WHERE id = $1', [roleId])
    if (roleRows.length === 0) return null

    const { rows: permRows } = await pool.query(
      `SELECT rp.*, m.name AS module_name, m.description AS module_description, m.is_active AS module_is_active, m.id AS module_id_ref
       FROM perm_role_permissions rp
       JOIN perm_modules m ON m.id = rp.module_id
       WHERE rp.role_id = $1
       ORDER BY m.name`,
      [roleId]
    )

    return {
      ...roleRows[0],
      perm_role_permissions: permRows.map(rp => ({
        ...rp,
        perm_modules: { id: rp.module_id_ref, name: rp.module_name, description: rp.module_description, is_active: rp.module_is_active },
      })),
    }
  }

  static async updateRolePermissions(roleId: string, moduleId: string, permissions: UpdateRolePermissionsDto, changedBy?: string): Promise<RolePermission | null> {
    try {
      const { rows: existing } = await pool.query(
        'SELECT * FROM perm_role_permissions WHERE role_id = $1 AND module_id = $2',
        [roleId, moduleId]
      )

      const oldPerm = existing[0] || null
      let result: RolePermission

      if (!oldPerm) {
        const { rows } = await pool.query(
          `INSERT INTO perm_role_permissions (role_id, module_id, can_view, can_insert, can_update, can_delete, can_approve, can_release)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [roleId, moduleId, permissions.can_view ?? false, permissions.can_insert ?? false, permissions.can_update ?? false, permissions.can_delete ?? false, permissions.can_approve ?? false, permissions.can_release ?? false]
        )
        result = rows[0]
      } else {
        const sets: string[] = []
        const params: (string | boolean)[] = []
        let idx = 1
        for (const [key, val] of Object.entries(permissions)) {
          if (val !== undefined) { sets.push(`${key} = $${idx}`); params.push(val); idx++ }
        }
        if (sets.length === 0) return oldPerm as RolePermission
        params.push(roleId, moduleId)
        const { rows } = await pool.query(
          `UPDATE perm_role_permissions SET ${sets.join(', ')} WHERE role_id = $${idx} AND module_id = $${idx + 1} RETURNING *`,
          params
        )
        result = rows[0]
      }

      if (changedBy) {
        await this.logAudit({ action: oldPerm ? 'UPDATE' : 'CREATE', entity_type: 'permission', entity_id: roleId, changed_by: changedBy, old_value: oldPerm, new_value: permissions })
      }

      await this.invalidateRoleCache(roleId)
      await this.invalidateAllCache()
      return result
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Failed to update role permissions', { roleId, moduleId, error: msg })
      throw error
    }
  }

  static async bulkUpdateRolePermissions(roleId: string, updates: Array<{ moduleId: string; permissions: UpdateRolePermissionsDto }>, changedBy?: string): Promise<boolean> {
    try {
      for (const update of updates) {
        await this.updateRolePermissions(roleId, update.moduleId, update.permissions, changedBy)
      }
      return true
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Bulk update failed', { roleId, error: msg })
      return false
    }
  }

  private static async getFromCache(userId: string): Promise<PermissionMatrix | null> {
    try {
      const { rows } = await pool.query(
        'SELECT permissions FROM perm_cache WHERE user_id = $1 AND expires_at > NOW()',
        [userId]
      )
      if (rows.length === 0) return null
      const permissions = rows[0].permissions as PermissionMatrix
      return permissions && Object.keys(permissions).length > 0 ? permissions : null
    } catch {
      return null
    }
  }

  private static async updateCache(userId: string): Promise<void> {
    try {
      const permissions = await this.getUserPermissions(userId)
      const expiresAt = new Date(Date.now() + PERMISSION_CACHE_TTL).toISOString()
      await pool.query(
        `INSERT INTO perm_cache (user_id, permissions, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET permissions = $2, expires_at = $3`,
        [userId, JSON.stringify(permissions), expiresAt]
      )
      this.memoryCache.set(userId, { permissions, expiresAt: Date.now() + this.MEMORY_CACHE_TTL })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Cache update failed', { userId, error: msg })
    }
  }

  static async invalidateRoleCache(roleId: string): Promise<void> {
    try {
      const { rows } = await pool.query('SELECT user_id FROM perm_user_profiles WHERE role_id = $1', [roleId])
      if (rows.length > 0) {
        const userIds = rows.map(r => r.user_id)
        await pool.query('DELETE FROM perm_cache WHERE user_id = ANY($1::uuid[])', [userIds])
        userIds.forEach(id => { this.memoryCache.delete(id); this.userPermissionsCache.delete(id) })
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Cache invalidation failed', { roleId, error: msg })
    }
  }

  static async invalidateAllCache(): Promise<void> {
    try {
      await pool.query("DELETE FROM perm_cache WHERE user_id != '00000000-0000-0000-0000-000000000000'")
      this.memoryCache.clear()
      this.userPermissionsCache.clear()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Cache invalidation failed', { error: msg })
    }
  }

  private static async logAudit(audit: { action: string; entity_type: string; entity_id: string; changed_by: string; old_value?: unknown; new_value?: unknown }): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO perm_audit_log (action, entity_type, entity_id, changed_by, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [audit.action, audit.entity_type, audit.entity_id, audit.changed_by, JSON.stringify(audit.old_value), JSON.stringify(audit.new_value)]
      )
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Audit logging failed', { error: msg })
    }
  }

  static async getAuditLogs(entityType: string, entityId: string, limit = 50) {
    const { rows } = await pool.query(
      'SELECT * FROM perm_audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT $3',
      [entityType, entityId, limit]
    )
    return rows
  }
}
