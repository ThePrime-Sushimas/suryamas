import { pool } from '../../config/db'
import { AuthUserRow } from './auth.types'

export class AuthRepository {
  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    const { rows } = await pool.query(
      'SELECT * FROM auth_users WHERE email = $1',
      [email.toLowerCase()]
    )
    return rows[0] ?? null
  }

  async findUserById(id: string): Promise<AuthUserRow | null> {
    const { rows } = await pool.query(
      'SELECT * FROM auth_users WHERE id = $1',
      [id]
    )
    return rows[0] ?? null
  }

  async createUser(id: string, email: string, encryptedPassword: string): Promise<AuthUserRow> {
    const { rows } = await pool.query(
      `INSERT INTO auth_users (id, email, encrypted_password, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
      [id, email.toLowerCase(), encryptedPassword]
    )
    return rows[0]
  }

  async findEmployeeByEmployeeId(employeeId: string): Promise<{ employee_id: string; user_id: string | null; full_name: string; resign_date: string | null } | null> {
    const { rows } = await pool.query(
      'SELECT employee_id, user_id, full_name, resign_date FROM employees WHERE employee_id = $1',
      [employeeId]
    )
    return rows[0] ?? null
  }

  async findEmployeeByUserId(userId: string): Promise<{ resign_date: string | null } | null> {
    const { rows } = await pool.query(
      'SELECT resign_date FROM employees WHERE user_id = $1',
      [userId]
    )
    return rows[0] ?? null
  }

  async linkEmployeeToUser(employeeId: string, userId: string): Promise<void> {
    await pool.query(
      'UPDATE employees SET user_id = $1 WHERE employee_id = $2',
      [userId, employeeId]
    )
  }

  async findRoleByName(name: string): Promise<{ id: string } | null> {
    const { rows } = await pool.query(
      'SELECT id FROM perm_roles WHERE name = $1',
      [name]
    )
    return rows[0] ?? null
  }

  async createUserProfile(userId: string, roleId: string): Promise<void> {
    await pool.query(
      'INSERT INTO perm_user_profiles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId]
    )
  }

  async setResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE auth_users SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW() WHERE email = $3',
      [token, expiresAt, email.toLowerCase()]
    )
    return (rowCount ?? 0) > 0
  }

  async findUserByResetToken(token: string): Promise<AuthUserRow | null> {
    const { rows } = await pool.query(
      'SELECT * FROM auth_users WHERE reset_token = $1 AND reset_token_expires_at > NOW()',
      [token]
    )
    return rows[0] ?? null
  }

  async updatePassword(userId: string, encryptedPassword: string): Promise<void> {
    await pool.query(
      'UPDATE auth_users SET encrypted_password = $1, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW() WHERE id = $2',
      [encryptedPassword, userId]
    )
  }
}

export const authRepository = new AuthRepository()
