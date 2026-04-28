import { pool } from '../../../config/db'
import { logInfo } from '../../../config/logger'
import type {
  PosImport,
  CreatePosImportDto,
  UpdatePosImportDto,
  PosImportFilter
} from './pos-imports.types'
import type { PaginationParams, SortParams } from '../../../types/request.types'

const ALLOWED_SORT_FIELDS = new Set([
  'created_at', 'date_range_start', 'date_range_end', 'file_name', 'status', 'total_rows'
])

const INSERT_FIELDS = [
  'company_id', 'branch_id', 'date_range_start', 'date_range_end',
  'file_name', 'total_rows', 'new_rows', 'duplicate_rows'
] as const

const UPDATE_FIELDS = [
  'status', 'error_message', 'journal_id', 'total_rows',
  'new_rows', 'duplicate_rows', 'chunk_info'
] as const

function escapeSearch(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

export class PosImportsRepository {

  async findAll(
    companyId: string,
    pagination: PaginationParams,
    sort?: SortParams,
    filter?: PosImportFilter
  ): Promise<{ data: PosImport[]; total: number }> {
    const conditions: string[] = ['company_id = $1', 'is_deleted = false']
    const values: unknown[] = [companyId]
    let idx = 2

    if (filter?.branch_id) {
      conditions.push(`branch_id = $${idx++}`)
      values.push(filter.branch_id)
    }
    if (filter?.status) {
      conditions.push(`status = $${idx++}`)
      values.push(filter.status)
    }
    if (filter?.date_from) {
      conditions.push(`date_range_start >= $${idx++}`)
      values.push(filter.date_from)
    }
    if (filter?.date_to) {
      conditions.push(`date_range_end <= $${idx++}`)
      values.push(filter.date_to)
    }
    if (filter?.search) {
      conditions.push(`file_name ILIKE $${idx++}`)
      values.push(`%${escapeSearch(filter.search)}%`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const sortField = sort?.field && ALLOWED_SORT_FIELDS.has(sort.field) ? sort.field : 'created_at'
    const sortOrder = sort?.order === 'asc' ? 'ASC' : 'DESC'
    const offset = (pagination.page - 1) * pagination.limit

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM pos_imports ${where}
         ORDER BY ${sortField} ${sortOrder}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, pagination.limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM pos_imports ${where}`,
        values
      ),
    ])

    return { data: dataRes.rows, total: countRes.rows[0]?.total ?? 0 }
  }

  async findById(id: string, companyId: string): Promise<PosImport | null> {
    const { rows } = await pool.query(
      `SELECT * FROM pos_imports WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findByIdOnly(id: string): Promise<PosImport | null> {
    const { rows } = await pool.query(
      `SELECT * FROM pos_imports WHERE id = $1 AND is_deleted = false`,
      [id]
    )
    return rows[0] ?? null
  }

  async findByIdWithLines(id: string, companyId: string): Promise<(PosImport & { pos_import_lines: unknown[] }) | null> {
    const { rows: importRows } = await pool.query(
      `SELECT * FROM pos_imports WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId]
    )
    if (importRows.length === 0) return null

    const { rows: lines } = await pool.query(
      `SELECT * FROM pos_import_lines WHERE pos_import_id = $1 ORDER BY row_number ASC`,
      [id]
    )

    return { ...importRows[0], pos_import_lines: lines }
  }

  async create(dto: CreatePosImportDto, userId: string): Promise<PosImport> {
    const cols = [...INSERT_FIELDS, 'created_by', 'updated_by']
    const vals = INSERT_FIELDS.map(f => (dto as unknown as Record<string, unknown>)[f])
    vals.push(userId, userId)
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')

    const { rows } = await pool.query(
      `INSERT INTO pos_imports (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    )

    logInfo('PosImportsRepository create success', { id: rows[0].id })
    return rows[0]
  }

  async update(id: string, companyId: string, updates: UpdatePosImportDto, userId: string): Promise<PosImport | null> {
    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1

    for (const field of UPDATE_FIELDS) {
      if ((updates as Record<string, unknown>)[field] !== undefined) {
        sets.push(`${field} = $${idx++}`)
        const val = (updates as Record<string, unknown>)[field]
        values.push(field === 'chunk_info' ? JSON.stringify(val) : val)
      }
    }

    if (sets.length === 0) return this.findById(id, companyId)

    sets.push(`updated_by = $${idx++}`)
    values.push(userId)
    sets.push(`updated_at = NOW()`)

    values.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE pos_imports SET ${sets.join(', ')}
       WHERE id = $${idx++} AND company_id = $${idx} AND is_deleted = false
       RETURNING *`,
      values
    )

    if (rows.length === 0) return null
    logInfo('PosImportsRepository update success', { id })
    return rows[0]
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE pos_imports SET is_deleted = true, deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [userId, id, companyId]
    )
    logInfo('PosImportsRepository delete success', { id })
  }

  async restore(id: string, companyId: string, userId: string): Promise<PosImport | null> {
    const { rows } = await pool.query(
      `UPDATE pos_imports
       SET is_deleted = false, deleted_at = NULL, deleted_by = NULL, updated_at = NOW(), updated_by = $1
       WHERE id = $2 AND company_id = $3 AND is_deleted = true
       RETURNING *`,
      [userId, id, companyId]
    )
    if (rows.length === 0) return null
    logInfo('PosImportsRepository restore success', { id })
    return rows[0]
  }
}

export const posImportsRepository = new PosImportsRepository()
