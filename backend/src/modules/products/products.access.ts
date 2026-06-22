/**
 * Product Station Access Utility
 *
 * Resolves user's allowed station codes (position_codes) for product filtering.
 * Uses the same dual-source pattern as wip-access.util.ts:
 *   - employee_positions (global positions)
 *   - employee_branches (per-branch positions)
 *
 * Products.station stores position_code (VARCHAR), so we resolve codes directly.
 */
import { pool } from '../../config/db'

export interface UserStationAccess {
  stationCodes: string[]
  canAccessAll: boolean
}

/**
 * Resolve position_codes the user is allowed to access.
 * If any of their positions has can_access_all_wip = true, they bypass filtering.
 */
export async function resolveUserStationAccess(userId: string): Promise<UserStationAccess> {
  const { rows } = await pool.query(`
    SELECT DISTINCT p.position_code, p.can_access_all_wip
    FROM employees e
    LEFT JOIN employee_positions ep ON ep.employee_id = e.id AND ep.is_deleted = false
    LEFT JOIN positions p ON p.id = ep.position_id AND p.is_deleted = false
    WHERE e.user_id = $1 AND e.deleted_at IS NULL
    UNION
    SELECT DISTINCT p.position_code, p.can_access_all_wip
    FROM employees e
    JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
    JOIN positions p ON p.id = eb.position_id AND p.is_deleted = false
    WHERE e.user_id = $1 AND e.deleted_at IS NULL AND eb.position_id IS NOT NULL
  `, [userId])

  return {
    stationCodes: rows.filter(r => r.position_code).map(r => r.position_code),
    canAccessAll: rows.some(r => r.can_access_all_wip),
  }
}
