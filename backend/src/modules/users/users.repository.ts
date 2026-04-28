import { pool } from '../../config/db'

export class UsersRepository {
  async getAllUsersWithEmployees() {
    const [empRes, profileRes] = await Promise.all([
      pool.query(
        `SELECT e.employee_id, e.full_name, e.job_position, e.email, e.user_id,
                eb.is_primary, b.id AS branch_id, b.branch_name
         FROM employees e
         LEFT JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
         LEFT JOIN branches b ON b.id = eb.branch_id`
      ),
      pool.query(
        `SELECT up.user_id, up.role_id, r.id AS role_ref_id, r.name AS role_name, r.description AS role_description
         FROM perm_user_profiles up
         LEFT JOIN perm_roles r ON r.id = up.role_id`
      ),
    ])
    return { employees: empRes.rows, profiles: profileRes.rows }
  }

  async getEmployeeWithBranchByEmployeeId(employeeId: string) {
    const { rows } = await pool.query(
      `SELECT e.employee_id, e.full_name, e.job_position, e.email, e.user_id,
              eb.is_primary, b.id AS branch_id, b.branch_name
       FROM employees e
       LEFT JOIN employee_branches eb ON eb.employee_id = e.id AND eb.is_primary = true
       LEFT JOIN branches b ON b.id = eb.branch_id
       WHERE e.employee_id = $1`,
      [employeeId]
    )
    return rows[0] ?? null
  }

  async getProfileByUserId(userId: string) {
    const { rows } = await pool.query(
      `SELECT up.user_id, up.role_id, r.id AS role_ref_id, r.name AS role_name, r.description AS role_description
       FROM perm_user_profiles up
       LEFT JOIN perm_roles r ON r.id = up.role_id
       WHERE up.user_id = $1`,
      [userId]
    )
    return rows[0] ?? null
  }

  async getUserRole(userId: string) {
    const profile = await this.getProfileByUserId(userId)
    if (!profile) return null
    return {
      user_id: profile.user_id,
      role_id: profile.role_id,
      perm_roles: profile.role_ref_id ? { id: profile.role_ref_id, name: profile.role_name, description: profile.role_description } : null,
    }
  }

  async assignRole(userId: string, roleId: string) {
    const { rows } = await pool.query(
      `INSERT INTO perm_user_profiles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET role_id = $2
       RETURNING *`,
      [userId, roleId]
    )
    return rows[0]
  }

  async removeRole(userId: string) {
    await pool.query('UPDATE perm_user_profiles SET role_id = NULL WHERE user_id = $1', [userId])
    return true
  }

  async invalidatePermCache(userId: string): Promise<void> {
    await pool.query('DELETE FROM perm_cache WHERE user_id = $1', [userId])
  }

  async getEmployeeUserIdByEmployeeId(employeeId: string): Promise<{ user_id: string | null; full_name: string } | null> {
    const { rows } = await pool.query(
      'SELECT user_id, full_name FROM employees WHERE employee_id = $1',
      [employeeId]
    )
    return rows[0] ?? null
  }

  async getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
    const { rows } = await pool.query('SELECT user_id FROM employees WHERE employee_id = $1', [employeeId])
    return rows[0]?.user_id ?? null
  }
}
