import { pool } from '../../config/db'

const EMPLOYEE_WITH_BRANCH_ROLE_SELECT = `
  SELECT e.employee_id, e.full_name, ep_pos.position_name AS job_position, e.email, e.user_id,
         eb.is_primary, b.id AS branch_id, b.branch_name,
         eb.role_id, r.id AS role_ref_id, r.name AS role_name, r.description AS role_description
  FROM employees e
  LEFT JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true AND eb.status = 'active'
  LEFT JOIN branches b ON b.id = eb.branch_id
  LEFT JOIN perm_roles r ON r.id = eb.role_id
  LEFT JOIN employee_positions ep ON ep.employee_id = e.id AND ep.is_primary = true AND ep.is_deleted = false
  LEFT JOIN positions ep_pos ON ep_pos.id = ep.position_id AND ep_pos.is_deleted = false
`

export class UsersRepository {
  async getAllUsersWithEmployees() {
    const { rows } = await pool.query(`${EMPLOYEE_WITH_BRANCH_ROLE_SELECT} ORDER BY e.full_name`)
    return rows
  }

  async getEmployeeWithBranchByEmployeeId(employeeId: string) {
    const { rows } = await pool.query(
      `${EMPLOYEE_WITH_BRANCH_ROLE_SELECT} WHERE e.employee_id = $1`,
      [employeeId],
    )
    return rows[0] ?? null
  }

  async getBranchRoleByUserId(userId: string) {
    const { rows } = await pool.query(
      `SELECT eb.role_id, r.id AS role_ref_id, r.name AS role_name, r.description AS role_description
       FROM employees e
       JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true AND eb.status = 'active'
       LEFT JOIN perm_roles r ON r.id = eb.role_id
       WHERE e.user_id = $1
       LIMIT 1`,
      [userId],
    )
    return rows[0] ?? null
  }

  async getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
    const { rows } = await pool.query('SELECT user_id FROM employees WHERE employee_id = $1', [employeeId])
    return rows[0]?.user_id ?? null
  }
}
