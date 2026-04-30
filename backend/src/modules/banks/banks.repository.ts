import { pool } from '../../config/db'
import type { Bank, CreateBankDto, UpdateBankDto, BankListQuery, BankOption } from './banks.types'
import { logDebug, logError } from '../../config/logger'

export class BanksRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    query?: BankListQuery
  ): Promise<{ data: Bank[]; total: number }> {
    const startTime = Date.now()
    try {
      const conditions: string[] = []
      const params: (string | boolean)[] = []
      let idx = 1

      if (query?.search) {
        const searchTerm = query.search.replace(/[%_]/g, '\\$&')
        params.push(`%${searchTerm}%`)
        conditions.push(`(bank_code ILIKE $${idx} OR bank_name ILIKE $${idx})`)
        idx++
      }
      if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`is_active = $${idx}`); idx++ }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM banks ${where} ORDER BY bank_name ASC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM banks ${where}`, params)
      ])

      logDebug('Banks query executed', { query: 'findAll', duration: Date.now() - startTime, rowCount: dataRes.rows.length, total: countRes.rows[0].total })
      return { data: dataRes.rows, total: countRes.rows[0].total }
    } catch (error) {
      logError('Banks repository error', { method: 'findAll', error })
      throw error
    }
  }

  async findById(id: number): Promise<Bank | null> {
    const { rows } = await pool.query('SELECT * FROM banks WHERE id = $1', [id])
    return rows[0] ?? null
  }

  async findByCode(code: string, excludeId?: number): Promise<Bank | null> {
    const params: (string | number)[] = [code]
    let query = 'SELECT * FROM banks WHERE bank_code = $1'
    if (excludeId) { params.push(excludeId); query += ' AND id != $2' }
    const { rows } = await pool.query(query, params)
    return rows[0] ?? null
  }

  async create(data: CreateBankDto): Promise<Bank> {
    const insertData: Record<string, unknown> = { ...data, is_active: data.is_active ?? true }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO banks (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: number, updates: UpdateBankDto): Promise<Bank | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE banks SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async deleteById(id: number): Promise<void> {
    await pool.query('UPDATE banks SET is_active = false WHERE id = $1', [id])
  }

  async isUsedInBankAccounts(id: number): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM bank_accounts WHERE bank_id = $1 AND deleted_at IS NULL', [id])
    return rows[0].cnt > 0
  }

  async getActiveOptions(): Promise<BankOption[]> {
    const { rows } = await pool.query("SELECT id, bank_code, bank_name FROM banks WHERE is_active = true ORDER BY bank_name")
    return rows
  }
}

export const banksRepository = new BanksRepository()
