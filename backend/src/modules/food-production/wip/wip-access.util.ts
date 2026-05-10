/**
 * WIP Position Access Utility
 *
 * Reusable functions to check if a user can access specific WIP items
 * based on their position assignments.
 *
 * Used by: production-orders (create), wip list (filter_by_position)
 */
import { pool } from '../../../config/db'

export interface UserWipAccess {
  positionIds: string[]
  canAccessAll: boolean
}

/**
 * Resolve user's position IDs and bypass flag.
 * Combines positions from employee_positions (cover) + employee_branches (per-branch).
 */
export async function resolveUserWipAccess(userId: string): Promise<UserWipAccess> {
  const { rows } = await pool.query(`
    SELECT DISTINCT p.id AS position_id, p.can_access_all_wip
    FROM employees e
    LEFT JOIN employee_positions ep ON ep.employee_id = e.id AND ep.is_deleted = false
    LEFT JOIN positions p ON p.id = ep.position_id AND p.is_deleted = false
    WHERE e.user_id = $1 AND e.deleted_at IS NULL
    UNION
    SELECT DISTINCT p.id AS position_id, p.can_access_all_wip
    FROM employees e
    JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
    JOIN positions p ON p.id = eb.position_id AND p.is_deleted = false
    WHERE e.user_id = $1 AND e.deleted_at IS NULL AND eb.position_id IS NOT NULL
  `, [userId])

  return {
    positionIds: rows.filter(r => r.position_id).map(r => r.position_id),
    canAccessAll: rows.some(r => r.can_access_all_wip),
  }
}

/**
 * Check if a user can access a specific WIP item.
 * Rules:
 *   1. WIP has no records in wip_position_access → everyone can access
 *   2. User has can_access_all_wip position → always allowed
 *   3. User has a position that is in wip_position_access → allowed
 */
export async function canUserAccessWip(userId: string, wipId: string): Promise<boolean> {
  // Check if WIP has any position restrictions
  const { rows: restrictions } = await pool.query(
    `SELECT position_id FROM wip_position_access WHERE wip_id = $1`,
    [wipId]
  )
  if (restrictions.length === 0) return true // No restriction → all allowed

  const access = await resolveUserWipAccess(userId)
  if (access.canAccessAll) return true

  const allowedPositionIds = new Set(restrictions.map(r => r.position_id))
  return access.positionIds.some(pid => allowedPositionIds.has(pid))
}

/**
 * Batch check: filter WIP IDs to only those the user can access.
 * More efficient than calling canUserAccessWip per item.
 */
export async function filterAccessibleWipIds(userId: string, wipIds: string[]): Promise<string[]> {
  if (wipIds.length === 0) return []

  const access = await resolveUserWipAccess(userId)
  if (access.canAccessAll) return wipIds

  // Get all restrictions for the requested WIPs
  const { rows: restrictions } = await pool.query(
    `SELECT wip_id, position_id FROM wip_position_access WHERE wip_id = ANY($1::uuid[])`,
    [wipIds]
  )

  // Group restrictions by wip_id
  const restrictionMap = new Map<string, string[]>()
  for (const r of restrictions) {
    const list = restrictionMap.get(r.wip_id) || []
    list.push(r.position_id)
    restrictionMap.set(r.wip_id, list)
  }

  const userPositionSet = new Set(access.positionIds)

  return wipIds.filter(wipId => {
    const required = restrictionMap.get(wipId)
    if (!required) return true // No restriction
    return required.some(pid => userPositionSet.has(pid))
  })
}
