import { Category } from './categories.types'

export function mapCategory(row: any): Category {
  if (!row || typeof row !== 'object') {
    throw new Error('Invalid category row: not an object')
  }

  if (typeof row.id !== 'string') {
    throw new Error('Invalid category row: id missing')
  }

  if (typeof row.category_code !== 'string') {
    throw new Error('Invalid category row: category_code missing')
  }

  if (typeof row.category_name !== 'string') {
    throw new Error('Invalid category row: category_name missing')
  }

  if (typeof row.sort_order !== 'number') {
    throw new Error('Invalid category row: sort_order missing')
  }

  if (typeof row.is_active !== 'boolean') {
    throw new Error('Invalid category row: is_active missing')
  }

  if (typeof row.is_deleted !== 'boolean') {
    throw new Error('Invalid category row: is_deleted missing')
  }

  if (typeof row.created_at !== 'string') {
    throw new Error('Invalid category row: created_at missing')
  }

  if (typeof row.updated_at !== 'string') {
    throw new Error('Invalid category row: updated_at missing')
  }

  return {
    id: row.id,
    category_code: row.category_code,
    category_name: row.category_name,
    description: row.description || null,
    sort_order: row.sort_order,
    is_active: row.is_active,
    is_deleted: row.is_deleted,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
  }
}
