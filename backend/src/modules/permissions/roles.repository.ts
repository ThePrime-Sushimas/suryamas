import { pool } from '../../config/db'
import type { Role, CreateRoleDto } from './permissions.types'

export class RolesRepository {
  async getAll(): Promise<Role[]> {
    const { rows } = await pool.query('SELECT * FROM perm_roles ORDER BY name')
    return rows as Role[]
  }

  async findById(id: string) {
    const { rows: roleRows } = await pool.query('SELECT * FROM perm_roles WHERE id = $1', [id])
    if (roleRows.length === 0) return null

    const { rows: permRows } = await pool.query(
      `SELECT rp.*, m.id AS m_id, m.name AS m_name, m.description AS m_description, m.is_active AS m_is_active, m.created_at AS m_created_at, m.updated_at AS m_updated_at
       FROM perm_role_permissions rp
       JOIN perm_modules m ON m.id = rp.module_id
       WHERE rp.role_id = $1
       ORDER BY m.name`,
      [id]
    )

    return {
      ...roleRows[0],
      perm_role_permissions: permRows.map(rp => ({
        ...rp,
        perm_modules: { id: rp.m_id, name: rp.m_name, description: rp.m_description, is_active: rp.m_is_active, created_at: rp.m_created_at, updated_at: rp.m_updated_at },
      })),
    }
  }

  async getByName(name: string): Promise<Role | null> {
    const { rows } = await pool.query('SELECT * FROM perm_roles WHERE name = $1', [name])
    return (rows[0] as Role) ?? null
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const { rows } = await pool.query(
      'INSERT INTO perm_roles (name, description) VALUES ($1, $2) RETURNING *',
      [dto.name, dto.description]
    )
    return rows[0] as Role
  }

  async update(id: string, updates: Partial<Role>): Promise<Role> {
    const keys = Object.keys(updates)
    if (!keys.length) {
      const { rows } = await pool.query('SELECT * FROM perm_roles WHERE id = $1', [id])
      return rows[0] as Role
    }
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(`UPDATE perm_roles SET ${set} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
    return rows[0] as Role
  }

  async delete(id: string): Promise<boolean> {
    const role = await this.findById(id)
    if ((role as Record<string, unknown>)?.is_system_role) throw new Error('Cannot delete system role')
    const { rowCount } = await pool.query('DELETE FROM perm_roles WHERE id = $1', [id])
    return (rowCount ?? 0) > 0
  }
}
