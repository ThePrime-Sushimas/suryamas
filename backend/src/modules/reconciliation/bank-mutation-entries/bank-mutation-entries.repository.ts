import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'
import type { BankMutationEntryRow, BankMutationEntryStatus, BankMutationEntryType } from './bank-mutation-entries.types'
import { BankMutationEntryNotFoundError, BankMutationEntryDatabaseError } from './bank-mutation-entries.errors'

function escapeSearch(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

export class BankMutationEntriesRepository {

  async create(data: {
    companyId: string; entryDate: string; entryType: BankMutationEntryType;
    description: string; amount: number; referenceNumber?: string; bankAccountId?: number;
    coaId: string; coaCode?: string; coaName?: string; bankStatementId: string;
    reconciledBy?: string; notes?: string; createdBy?: string;
  }): Promise<BankMutationEntryRow> {
    const now = new Date().toISOString()
    const { rows } = await pool.query(
      `INSERT INTO bank_mutation_entries
       (company_id, entry_date, entry_type, description, amount, reference_number,
        bank_account_id, coa_id, coa_code, coa_name, bank_statement_id,
        is_reconciled, reconciled_at, reconciled_by, notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$15)
       RETURNING *`,
      [data.companyId, data.entryDate, data.entryType, data.description, data.amount,
       data.referenceNumber || null, data.bankAccountId || null,
       data.coaId, data.coaCode || null, data.coaName || null, data.bankStatementId,
       now, data.reconciledBy || null, data.notes || null, data.createdBy || null]
    )
    if (rows.length === 0) throw new BankMutationEntryDatabaseError('create', 'No row returned')
    return rows[0]
  }

  async findById(id: string, companyId: string): Promise<BankMutationEntryRow | null> {
    const { rows } = await pool.query(
      `SELECT * FROM bank_mutation_entries WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<BankMutationEntryRow> {
    const row = await this.findById(id, companyId)
    if (!row) throw new BankMutationEntryNotFoundError(id)
    return row
  }

  async findByBankStatementId(bankStatementId: string): Promise<BankMutationEntryRow | null> {
    const { rows } = await pool.query(
      `SELECT * FROM bank_mutation_entries WHERE bank_statement_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [bankStatementId]
    )
    return rows[0] ?? null
  }

  async list(filter: {
    companyId: string; bankAccountId?: number; entryType?: BankMutationEntryType;
    status?: BankMutationEntryStatus; isReconciled?: boolean;
    dateFrom?: string; dateTo?: string; search?: string; limit: number; offset: number;
  }): Promise<{ data: BankMutationEntryRow[]; total: number }> {
    const conditions: string[] = ['company_id = $1', 'deleted_at IS NULL']
    const values: unknown[] = [filter.companyId]
    let idx = 2

    if (filter.bankAccountId) { conditions.push(`bank_account_id = $${idx++}`); values.push(filter.bankAccountId) }
    if (filter.entryType) { conditions.push(`entry_type = $${idx++}`); values.push(filter.entryType) }
    if (filter.status) { conditions.push(`status = $${idx++}`); values.push(filter.status) }
    if (filter.isReconciled !== undefined) { conditions.push(`is_reconciled = $${idx++}`); values.push(filter.isReconciled) }
    if (filter.dateFrom) { conditions.push(`entry_date >= $${idx++}`); values.push(filter.dateFrom) }
    if (filter.dateTo) { conditions.push(`entry_date <= $${idx++}`); values.push(filter.dateTo) }
    if (filter.search) {
      const term = `%${escapeSearch(filter.search)}%`
      conditions.push(`(description ILIKE $${idx} OR reference_number ILIKE $${idx})`)
      values.push(term); idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM bank_mutation_entries ${where}
         ORDER BY entry_date DESC, created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, filter.limit, filter.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM bank_mutation_entries ${where}`, values),
    ])

    return { data: dataRes.rows, total: countRes.rows[0]?.total ?? 0 }
  }

  async updateJournalHeaderId(id: string, journalHeaderId: string): Promise<void> {
    await pool.query(
      `UPDATE bank_mutation_entries SET journal_header_id = $1, updated_at = NOW() WHERE id = $2`,
      [journalHeaderId, id]
    )
  }

  async voidEntry(id: string, reason: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE bank_mutation_entries
       SET status = 'VOIDED', is_reconciled = false, void_reason = $1,
           voided_at = NOW(), voided_by = $2, updated_at = NOW(), updated_by = $2
       WHERE id = $3`,
      [reason, userId, id]
    )
  }

  async linkBankStatement(bankStatementId: string, mutationEntryId: string, userId?: string): Promise<void> {
    const sets = ['is_reconciled = true', 'is_pending = false', `bank_mutation_entry_id = $1`, 'updated_at = NOW()']
    const values: unknown[] = [mutationEntryId]
    let idx = 2
    if (userId) { sets.push(`updated_by = $${idx++}`); values.push(userId) }
    values.push(bankStatementId)

    await pool.query(
      `UPDATE bank_statements SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    )
  }

  async unlinkBankStatement(bankStatementId: string, userId?: string): Promise<void> {
    const sets = ['is_reconciled = false', 'bank_mutation_entry_id = NULL', 'updated_at = NOW()']
    const values: unknown[] = []
    let idx = 1
    if (userId) { sets.push(`updated_by = $${idx++}`); values.push(userId) }
    values.push(bankStatementId)

    await pool.query(
      `UPDATE bank_statements SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    )
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE bank_mutation_entries SET deleted_at = NOW(), updated_by = $1 WHERE id = $2`,
      [userId, id]
    )
  }

  async getBankAccountCoaId(bankAccountId: number): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT coa_id FROM bank_accounts WHERE id = $1`,
      [bankAccountId]
    )
    return rows[0]?.coa_id ?? null
  }
}

export const bankMutationEntriesRepository = new BankMutationEntriesRepository()
