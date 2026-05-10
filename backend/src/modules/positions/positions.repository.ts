import { pool } from '../../config/db'
import type { Position, PositionWithDepartment, CreatePositionDto, UpdatePositionDto } from './positions.types'

class PositionsRepository {

  async findAll(companyId: string, departmentId?: string): Promise<PositionWithDepartment[]> {
    const conditions = ['p.company_id = $1', 'p.is_deleted = false']
    const params: unknown[] = [companyId]

    if (departmentId) { params.push(departmentId); conditions.push(`p.department_id = $${params.length}`) }

    const { rows } = await pool.query(`
      SELECT p.*, d.department_code, d.department_name,
        (SELECT COUNT(*)::int FROM employee_positions ep WHERE ep.position_id = p.id AND ep.is_deleted = false) AS employee_count
      FROM positions p
      JOIN departments d ON d.id = p.department_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.sort_order, p.sort_order, p.position_name
    `, params)
    return rows
  }

  async findById(id: string, companyId: string): Promise<Position | null> {
    const { rows } = await pool.query(
      `SELECT * FROM positions WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async create(companyId: string, dto: CreatePositionDto): Promise<Position> {
    const { rows } = await pool.query(
      `INSERT INTO positions (company_id, department_id, position_code, position_name, can_access_all_wip, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
      [companyId, dto.department_id, dto.position_code, dto.position_name, dto.can_access_all_wip ?? false, dto.sort_order ?? 0, dto.created_by || null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdatePositionDto): Promise<Position | null> {
    const sets = ['updated_at = now()']
    const params: unknown[] = [id, companyId]
    let idx = 3

    if (dto.department_id !== undefined) { sets.push(`department_id = $${idx++}`); params.push(dto.department_id) }
    if (dto.position_name !== undefined) { sets.push(`position_name = $${idx++}`); params.push(dto.position_name) }
    if (dto.can_access_all_wip !== undefined) { sets.push(`can_access_all_wip = $${idx++}`); params.push(dto.can_access_all_wip) }
    if (dto.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(dto.sort_order) }
    if (dto.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.is_active) }
    if (dto.updated_by) { sets.push(`updated_by = $${idx++}`); params.push(dto.updated_by) }

    const { rows } = await pool.query(
      `UPDATE positions SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 AND is_deleted = false RETURNING *`,
      params
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE positions SET is_deleted = true, deleted_at = now(), updated_by = $3, updated_at = now()
       WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId, userId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasChildren(id: string): Promise<boolean> {
    const { rows } = await pool.query(`
      SELECT (
        (SELECT COUNT(*) FROM employee_positions WHERE position_id = $1 AND is_deleted = false) +
        (SELECT COUNT(*) FROM wip_position_access WHERE position_id = $1)
      )::int AS cnt
    `, [id])
    return rows[0].cnt > 0
  }
}

export const positionsRepository = new PositionsRepository()
