import { pool } from '../../config/db'
import type { Department, DepartmentWithCount, CreateDepartmentDto, UpdateDepartmentDto } from './departments.types'

class DepartmentsRepository {

  async findAll(companyIds: string[]): Promise<DepartmentWithCount[]> {
    if (!companyIds.length) return []
    const { rows } = await pool.query(`
      SELECT d.*,
        (SELECT COUNT(*)::int FROM positions p WHERE p.department_id = d.id AND p.is_deleted = false) AS position_count
      FROM departments d
      WHERE d.company_id = ANY($1::uuid[]) AND d.is_deleted = false
      ORDER BY d.sort_order, d.department_name
    `, [companyIds])
    return rows
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<Department | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT * FROM departments WHERE id = $1 AND company_id = ANY($2::uuid[]) AND is_deleted = false`,
      [id, companyIds]
    )
    return rows[0] ?? null
  }

  async findById(id: string, companyId: string): Promise<Department | null> {
    const { rows } = await pool.query(
      `SELECT * FROM departments WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async create(companyId: string, dto: CreateDepartmentDto): Promise<Department> {
    const { rows } = await pool.query(
      `INSERT INTO departments (company_id, department_code, department_name, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [companyId, dto.department_code, dto.department_name, dto.sort_order ?? 0, dto.created_by || null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateDepartmentDto): Promise<Department | null> {
    const sets = ['updated_at = now()']
    const params: unknown[] = [id, companyId]
    let idx = 3

    if (dto.department_name !== undefined) { sets.push(`department_name = $${idx++}`); params.push(dto.department_name) }
    if (dto.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(dto.sort_order) }
    if (dto.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.is_active) }
    if (dto.updated_by) { sets.push(`updated_by = $${idx++}`); params.push(dto.updated_by) }

    const { rows } = await pool.query(
      `UPDATE departments SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 AND is_deleted = false RETURNING *`,
      params
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE departments SET is_deleted = true, deleted_at = now(), updated_by = $3, updated_at = now()
       WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId, userId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasChildren(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM positions WHERE department_id = $1 AND is_deleted = false`,
      [id]
    )
    return rows[0].cnt > 0
  }
}

export const departmentsRepository = new DepartmentsRepository()
