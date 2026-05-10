import { pool } from '../../config/db'
import type { EmployeePosition, EmployeePositionWithDetails } from './employee-positions.types'

class EmployeePositionsRepository {

  async findByEmployee(employeeId: string): Promise<EmployeePositionWithDetails[]> {
    const { rows } = await pool.query(`
      SELECT ep.*, p.position_code, p.position_name, p.can_access_all_wip,
             d.department_code, d.department_name
      FROM employee_positions ep
      JOIN positions p ON p.id = ep.position_id
      JOIN departments d ON d.id = p.department_id
      WHERE ep.employee_id = $1 AND ep.is_deleted = false
      ORDER BY ep.is_primary DESC, d.sort_order, p.sort_order
    `, [employeeId])
    return rows
  }

  async findByUserPositions(userId: string): Promise<EmployeePositionWithDetails[]> {
    const { rows } = await pool.query(`
      SELECT ep.*, p.position_code, p.position_name, p.can_access_all_wip,
             d.department_code, d.department_name
      FROM employee_positions ep
      JOIN employees e ON e.id = ep.employee_id
      JOIN positions p ON p.id = ep.position_id
      JOIN departments d ON d.id = p.department_id
      WHERE e.user_id = $1 AND ep.is_deleted = false AND p.is_deleted = false
      ORDER BY ep.is_primary DESC
    `, [userId])
    return rows
  }

  async findOne(employeeId: string, positionId: string): Promise<EmployeePosition | null> {
    const { rows } = await pool.query(
      `SELECT * FROM employee_positions WHERE employee_id = $1 AND position_id = $2 AND is_deleted = false`,
      [employeeId, positionId]
    )
    return rows[0] ?? null
  }

  async countActive(employeeId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM employee_positions WHERE employee_id = $1 AND is_deleted = false`,
      [employeeId]
    )
    return rows[0].cnt
  }

  async assign(employeeId: string, positionId: string, isPrimary: boolean, assignedBy?: string): Promise<EmployeePosition> {
    const { rows } = await pool.query(
      `INSERT INTO employee_positions (employee_id, position_id, is_primary, assigned_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [employeeId, positionId, isPrimary, assignedBy || null]
    )
    return rows[0]
  }

  async remove(employeeId: string, positionId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE employee_positions SET is_deleted = true, deleted_at = now()
       WHERE employee_id = $1 AND position_id = $2 AND is_deleted = false`,
      [employeeId, positionId]
    )
    return (rowCount ?? 0) > 0
  }

  async clearPrimary(employeeId: string): Promise<void> {
    await pool.query(
      `UPDATE employee_positions SET is_primary = false
       WHERE employee_id = $1 AND is_primary = true AND is_deleted = false`,
      [employeeId]
    )
  }

  async setPrimary(employeeId: string, positionId: string): Promise<void> {
    await pool.query(
      `UPDATE employee_positions
       SET is_primary = (position_id = $2)
       WHERE employee_id = $1 AND is_deleted = false`,
      [employeeId, positionId]
    )
  }
}

export const employeePositionsRepository = new EmployeePositionsRepository()
