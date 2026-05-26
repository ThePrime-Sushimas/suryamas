import type { Request } from 'express'

/** auth_users.id — use for created_by / updated_by on all business tables and journal_headers. */
export function getAuthUserId(req: Request): string {
  const id = req.user?.id
  if (!id) throw new Error('Authentication required')
  return id
}
