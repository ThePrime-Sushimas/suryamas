import type { Category } from './categories.types'
import { CategoryErrors } from './categories.errors'

export function mapCategory(row: Record<string, unknown>): Category {
  if (!row || typeof row !== 'object') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: not an object')
  }

  if (typeof row.id !== 'string') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: id missing')
  }

  if (typeof row.category_code !== 'string') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: category_code missing')
  }

  if (typeof row.category_name !== 'string') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: category_name missing')
  }

  if (typeof row.sort_order !== 'number') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: sort_order missing')
  }

  if (typeof row.is_active !== 'boolean') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: is_active missing')
  }

  if (typeof row.is_deleted !== 'boolean') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: is_deleted missing')
  }

  if (typeof row.created_at !== 'string') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: created_at missing')
  }

  if (typeof row.updated_at !== 'string') {
    throw CategoryErrors.VALIDATION_ERROR('Invalid category row: updated_at missing')
  }

  return {
    id: row.id,
    category_code: row.category_code,
    category_name: row.category_name,
    description: (row.description as string) || null,
    sort_order: row.sort_order,
    is_active: row.is_active,
    is_deleted: row.is_deleted,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: (row.created_by as string) || null,
    updated_by: (row.updated_by as string) || null,
  }
}
