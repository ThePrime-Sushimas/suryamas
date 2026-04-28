import { pool } from '../../config/db'
import type { Module, CreateModuleDto } from './permissions.types'

export class ModulesRepository {
  async getAll(): Promise<Module[]> {
    const { rows } = await pool.query('SELECT * FROM perm_modules ORDER BY name')
    return rows as Module[]
  }

  async findById(id: string): Promise<Module | null> {
    const { rows } = await pool.query('SELECT * FROM perm_modules WHERE id = $1', [id])
    return (rows[0] as Module) ?? null
  }

  async getByName(name: string): Promise<Module | null> {
    const { rows } = await pool.query('SELECT * FROM perm_modules WHERE name = $1', [name])
    return (rows[0] as Module) ?? null
  }

  async create(dto: CreateModuleDto): Promise<Module> {
    const { rows } = await pool.query(
      'INSERT INTO perm_modules (name, description, is_active) VALUES ($1, $2, $3) RETURNING *',
      [dto.name, dto.description, dto.is_active ?? true]
    )
    return rows[0] as Module
  }

  async update(id: string, updates: Partial<Module>): Promise<Module> {
    const keys = Object.keys(updates)
    if (!keys.length) return (await this.findById(id))!
    const values = Object.values(updates)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const { rows } = await pool.query(`UPDATE perm_modules SET ${set} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
    return rows[0] as Module
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM perm_modules WHERE id = $1', [id])
    return (rowCount ?? 0) > 0
  }
}
