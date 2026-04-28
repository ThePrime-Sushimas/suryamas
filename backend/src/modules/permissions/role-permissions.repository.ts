import { pool } from '../../config/db'
import type { RolePermission, UpdateRolePermissionsDto } from './permissions.types'
import { employeesRepository } from '../employees/employees.repository'

export class RolePermissionsRepository {
  async getByRoleId(roleId: string): Promise<Array<RolePermission & { module_name: string }>> {
    const { rows } = await pool.query(
      `SELECT rp.*, m.name AS module_name
       FROM perm_role_permissions rp
       JOIN perm_modules m ON m.id = rp.module_id
       WHERE rp.role_id = $1
       ORDER BY m.name`,
      [roleId]
    )
    return rows as Array<RolePermission & { module_name: string }>
  }

  async get(roleId: string, moduleId: string): Promise<RolePermission | null> {
    const { rows } = await pool.query(
      'SELECT * FROM perm_role_permissions WHERE role_id = $1 AND module_id = $2',
      [roleId, moduleId]
    )
    return (rows[0] as RolePermission) ?? null
  }

  async create(permission: Partial<RolePermission>): Promise<RolePermission> {
    const keys = Object.keys(permission)
    const values = Object.values(permission)
    const cols = keys.join(', ')
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO perm_role_permissions (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    )
    return rows[0] as RolePermission
  }

  async update(roleId: string, moduleId: string, updates: UpdateRolePermissionsDto): Promise<RolePermission> {
    const keys = Object.keys(updates)
    if (!keys.length) {
      const existing = await this.get(roleId, moduleId)
      if (!existing) throw new Error('Permission not found')
      return existing
    }
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `UPDATE perm_role_permissions SET ${set} WHERE role_id = $${keys.length + 1} AND module_id = $${keys.length + 2} RETURNING *`,
      [...values, roleId, moduleId]
    )
    if (rows.length === 0) throw new Error('Permission not found')
    return rows[0] as RolePermission
  }

  async delete(roleId: string, moduleId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'DELETE FROM perm_role_permissions WHERE role_id = $1 AND module_id = $2',
      [roleId, moduleId]
    )
    return (rowCount ?? 0) > 0
  }

  async bulkCreate(permissions: Partial<RolePermission>[]): Promise<boolean> {
    if (!permissions.length) return true
    const keys = ['role_id', 'module_id', 'can_view', 'can_insert', 'can_update', 'can_delete', 'can_approve', 'can_release']
    const placeholders = permissions.map((_, i) =>
      `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`
    ).join(', ')
    const values = permissions.flatMap(p => keys.map(k => (p as Record<string, unknown>)[k] ?? false))
    await pool.query(`INSERT INTO perm_role_permissions (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`, values)
    return true
  }

  async getEmployeeByUserId(userId: string): Promise<{ id: string } | null> {
    return employeesRepository.findByUserId(userId)
  }

  async getEmployeeRoleId(employeeId: string): Promise<string | null> {
    const { rows } = await pool.query(
      "SELECT role_id FROM employee_branches WHERE employee_id = $1 AND status = 'active' AND is_primary = true",
      [employeeId]
    )
    return rows[0]?.role_id ?? null
  }
}
