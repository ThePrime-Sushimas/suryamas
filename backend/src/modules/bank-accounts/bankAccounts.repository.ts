import { pool } from '../../config/db'
import { DatabaseError } from '../../utils/error-handler.util'
import { BankAccount, BankAccountWithBank, CreateBankAccountDto, UpdateBankAccountDto, BankAccountListQuery, OwnerType } from './bankAccounts.types'

const SELECT_WITH_JOINS = `
  ba.*,
  bk.bank_code, bk.bank_name, bk.id AS bank_ref_id,
  coa.id AS coa_id, coa.account_code AS coa_account_code, coa.account_name AS coa_account_name, coa.account_type AS coa_account_type
`
const FROM_WITH_JOINS = `
  FROM bank_accounts ba
  LEFT JOIN banks bk ON bk.id = ba.bank_id
  LEFT JOIN chart_of_accounts coa ON coa.id = ba.coa_account_id
`

function mapRow(row: Record<string, unknown>): BankAccountWithBank {
  return {
    ...row,
    bank_code: row.bank_code,
    bank_name: row.bank_name,
    bank: row.bank_ref_id ? { id: row.bank_ref_id, bank_code: row.bank_code, bank_name: row.bank_name } : null,
    coa_account: row.coa_id ? { id: row.coa_id, account_code: row.coa_account_code, account_name: row.coa_account_name, account_type: row.coa_account_type } : null,
  } as unknown as BankAccountWithBank
}

export class BankAccountsRepository {
  async findAll(pagination: { limit: number; offset: number }, query?: BankAccountListQuery): Promise<{ data: BankAccountWithBank[]; total: number }> {
    const conditions: string[] = ['ba.deleted_at IS NULL']
    const params: (string | boolean | number)[] = []
    let idx = 1

    if (query?.owner_type) { params.push(query.owner_type); conditions.push(`ba.owner_type = $${idx}`); idx++ }
    if (query?.owner_id) { params.push(query.owner_id); conditions.push(`ba.owner_id = $${idx}`); idx++ }
    if (query?.bank_id) { params.push(query.bank_id); conditions.push(`ba.bank_id = $${idx}`); idx++ }
    if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`ba.is_active = $${idx}`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${SELECT_WITH_JOINS} ${FROM_WITH_JOINS} ${where} ORDER BY ba.is_primary DESC, ba.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM bank_accounts ba ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapRow), total: countRes.rows[0].total }
  }

  async findById(id: number): Promise<BankAccountWithBank | null> {
    const { rows } = await pool.query(`SELECT ${SELECT_WITH_JOINS} ${FROM_WITH_JOINS} WHERE ba.id = $1 AND ba.deleted_at IS NULL`, [id])
    return rows[0] ? mapRow(rows[0]) : null
  }

  async findByAccountNumber(bankId: number, accountNumber: string, excludeId?: number): Promise<BankAccount | null> {
    const params: (number | string)[] = [bankId, accountNumber]
    let query = 'SELECT * FROM bank_accounts WHERE bank_id = $1 AND account_number = $2 AND deleted_at IS NULL'
    if (excludeId) { params.push(excludeId); query += ' AND id != $3' }
    const { rows } = await pool.query(query, params)
    return rows[0] ?? null
  }

  async createAtomic(data: CreateBankAccountDto): Promise<BankAccount> {
    const insertData: Record<string, unknown> = {
      bank_id: data.bank_id, account_name: data.account_name, account_number: data.account_number,
      owner_type: data.owner_type, owner_id: data.owner_id,
      is_primary: data.is_primary ?? false, is_active: data.is_active ?? true, currency: 'IDR',
    }
    if (data.coa_account_id !== undefined) insertData.coa_account_id = data.coa_account_id

    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO bank_accounts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )

    const full = await this.findById(rows[0].id)
    return full as BankAccount
  }

  async updateAtomic(id: number, updates: UpdateBankAccountDto): Promise<BankAccount> {
    const existing = await this.findById(id)
    if (!existing) throw new DatabaseError('Bank account not found')

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.account_name !== undefined) updateData.account_name = updates.account_name
    if (updates.account_number !== undefined) updateData.account_number = updates.account_number
    if (updates.is_primary !== undefined) updateData.is_primary = updates.is_primary
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active
    if (updates.coa_account_id !== undefined) updateData.coa_account_id = updates.coa_account_id

    const keys = Object.keys(updateData)
    const values = Object.values(updateData)
    await pool.query(
      `UPDATE bank_accounts SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND deleted_at IS NULL`,
      [...values, id]
    )

    const full = await this.findById(id)
    return full as BankAccount
  }

  async softDelete(id: number, employeeId?: string): Promise<void> {
    await pool.query(
      'UPDATE bank_accounts SET deleted_at = NOW(), deleted_by = $1, is_active = false, is_primary = false, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL',
      [employeeId || null, id]
    )
  }

  async unsetPrimaryForOwner(ownerType: OwnerType, ownerId: string, excludeId?: number): Promise<void> {
    const params: (string | number)[] = [ownerType, ownerId]
    let query = 'UPDATE bank_accounts SET is_primary = false, updated_at = NOW() WHERE owner_type = $1 AND owner_id = $2 AND is_primary = true AND deleted_at IS NULL'
    if (excludeId) { params.push(excludeId); query += ' AND id != $3' }
    await pool.query(query, params)
  }

  async findByOwner(ownerType: OwnerType, ownerId: string): Promise<BankAccountWithBank[]> {
    const { rows } = await pool.query(
      `SELECT ${SELECT_WITH_JOINS} ${FROM_WITH_JOINS} WHERE ba.owner_type = $1 AND ba.owner_id = $2 AND ba.deleted_at IS NULL ORDER BY ba.is_primary DESC, ba.created_at DESC`,
      [ownerType, ownerId]
    )
    return rows.map(mapRow)
  }

  async findOwner(ownerType: OwnerType, ownerId: string): Promise<{ id: string; status?: string; deleted_at?: string } | null> {
    const table = ownerType === 'company' ? 'companies' : 'suppliers'
    const selectFields = ownerType === 'company' ? 'id, status' : 'id, deleted_at'
    const { rows } = await pool.query(`SELECT ${selectFields} FROM ${table} WHERE id = $1`, [ownerId])
    return rows[0] ?? null
  }

  async findBank(bankId: number): Promise<{ id: number; is_active: boolean } | null> {
    const { rows } = await pool.query('SELECT id, is_active FROM banks WHERE id = $1', [bankId])
    return rows[0] ?? null
  }

  async findCoaAccount(coaAccountId: string): Promise<{ id: string; account_code: string; account_name: string; account_type: string; is_active: boolean } | null> {
    const { rows } = await pool.query(
      'SELECT id, account_code, account_name, account_type, is_active FROM chart_of_accounts WHERE id = $1 AND deleted_at IS NULL',
      [coaAccountId]
    )
    return rows[0] ?? null
  }
}

export const bankAccountsRepository = new BankAccountsRepository()
