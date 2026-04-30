import { pool } from '../../config/db'
import type { ExpenseAutoRule, UncategorizedStatement } from './expense-categorization.types'

export class ExpenseCategorizationRepository {

  // ── Rules CRUD ──

  async listRules(companyId: string): Promise<ExpenseAutoRule[]> {
    const { rows } = await pool.query(
      `SELECT r.*, ap.purpose_code, ap.purpose_name
       FROM expense_auto_rules r
       JOIN accounting_purposes ap ON r.purpose_id = ap.id
       WHERE r.company_id = $1
       ORDER BY r.priority ASC, r.created_at ASC`,
      [companyId]
    )
    return rows
  }

  async findRuleById(id: string, companyId: string): Promise<ExpenseAutoRule | null> {
    const { rows } = await pool.query(
      `SELECT r.*, ap.purpose_code, ap.purpose_name
       FROM expense_auto_rules r
       JOIN accounting_purposes ap ON r.purpose_id = ap.id
       WHERE r.id = $1 AND r.company_id = $2`,
      [id, companyId]
    )
    return rows[0] || null
  }

  async createRule(companyId: string, dto: { purpose_id: string; pattern: string; match_type: string; priority: number }, userId: string): Promise<ExpenseAutoRule> {
    const { rows } = await pool.query(
      `INSERT INTO expense_auto_rules (company_id, purpose_id, pattern, match_type, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, dto.purpose_id, dto.pattern, dto.match_type, dto.priority, userId]
    )
    return (await this.findRuleById(rows[0].id, companyId))!
  }

  async updateRule(id: string, companyId: string, dto: Record<string, unknown>, userId: string): Promise<ExpenseAutoRule> {
    const fields: string[] = []
    const values: unknown[] = []

    for (const [key, val] of Object.entries(dto)) {
      if (val !== undefined) {
        values.push(val)
        fields.push(`${key} = $${values.length}`)
      }
    }
    values.push(userId)
    fields.push(`updated_by = $${values.length}`)

    values.push(id, companyId)
    await pool.query(
      `UPDATE expense_auto_rules SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND company_id = $${values.length}`,
      values
    )
    return (await this.findRuleById(id, companyId))!
  }

  async deleteRule(id: string, companyId: string): Promise<void> {
    await pool.query('DELETE FROM expense_auto_rules WHERE id = $1 AND company_id = $2', [id, companyId])
  }

  // ── Active rules for matching ──

  async getActiveRules(companyId: string): Promise<Array<{ id: string; purpose_id: string; pattern: string; match_type: string; priority: number; purpose_name: string }>> {
    const { rows } = await pool.query(
      `SELECT r.id, r.purpose_id, r.pattern, r.match_type, r.priority, ap.purpose_name
       FROM expense_auto_rules r
       JOIN accounting_purposes ap ON r.purpose_id = ap.id
       WHERE r.company_id = $1 AND r.is_active = true AND ap.is_active = true AND ap.deleted_at IS NULL
       ORDER BY r.priority ASC`,
      [companyId]
    )
    return rows
  }

  // ── Bank statement categorization ──

  async listUncategorized(companyId: string, filters: { bank_account_id?: number; purpose_id?: string; categorized?: string; search?: string; date_from?: string; date_to?: string }, page: number, limit: number): Promise<{ data: UncategorizedStatement[]; total: number }> {
    const conditions = ['bs.company_id = $1', 'bs.debit_amount > 0', 'bs.deleted_at IS NULL', 'bs.journal_id IS NULL']
    const params: unknown[] = [companyId]

    if (filters.bank_account_id) {
      params.push(filters.bank_account_id)
      conditions.push(`bs.bank_account_id = $${params.length}::bigint`)
    }
    if (filters.purpose_id) {
      params.push(filters.purpose_id)
      conditions.push(`bs.purpose_id = $${params.length}::uuid`)
    }
    if (filters.categorized === 'true') {
      conditions.push('bs.purpose_id IS NOT NULL')
    } else if (filters.categorized === 'false') {
      conditions.push('bs.purpose_id IS NULL')
    }
    if (filters.search) {
      params.push(`%${filters.search.toUpperCase()}%`)
      conditions.push(`UPPER(bs.description) LIKE $${params.length}`)
    }
    if (filters.date_from) {
      params.push(filters.date_from)
      conditions.push(`bs.transaction_date >= $${params.length}::date`)
    }
    if (filters.date_to) {
      params.push(filters.date_to)
      conditions.push(`bs.transaction_date <= $${params.length}::date`)
    }

    const where = conditions.join(' AND ')
    const offset = (page - 1) * limit

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT bs.id, bs.transaction_date, bs.description, bs.debit_amount, bs.reference_number,
                bs.purpose_id, ap.purpose_name
         FROM bank_statements bs
         LEFT JOIN accounting_purposes ap ON bs.purpose_id = ap.id
         WHERE ${where}
         ORDER BY bs.transaction_date DESC, bs.row_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int as total FROM bank_statements bs WHERE ${where}`,
        params
      ),
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async setCategoryBulk(statementIds: number[], purposeId: string, companyId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `UPDATE bank_statements SET purpose_id = $1
       WHERE id = ANY($2::bigint[]) AND company_id = $3 AND debit_amount > 0 AND journal_id IS NULL AND deleted_at IS NULL`,
      [purposeId, statementIds, companyId]
    )
    return rowCount ?? 0
  }

  async clearCategoryBulk(statementIds: number[], companyId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `UPDATE bank_statements SET purpose_id = NULL
       WHERE id = ANY($1::bigint[]) AND company_id = $2 AND journal_id IS NULL AND deleted_at IS NULL`,
      [statementIds, companyId]
    )
    return rowCount ?? 0
  }

  async getUncategorizedForAutoMatch(companyId: string, filters?: { bank_account_id?: number; date_from?: string; date_to?: string }): Promise<Array<{ id: number; description: string }>> {
    const conditions = ['company_id = $1', 'debit_amount > 0', 'purpose_id IS NULL', 'journal_id IS NULL', 'deleted_at IS NULL']
    const params: unknown[] = [companyId]

    if (filters?.bank_account_id) {
      params.push(filters.bank_account_id)
      conditions.push(`bank_account_id = $${params.length}::bigint`)
    }
    if (filters?.date_from) {
      params.push(filters.date_from)
      conditions.push(`transaction_date >= $${params.length}::date`)
    }
    if (filters?.date_to) {
      params.push(filters.date_to)
      conditions.push(`transaction_date <= $${params.length}::date`)
    }

    const { rows } = await pool.query(
      `SELECT id, description FROM bank_statements WHERE ${conditions.join(' AND ')}`,
      params
    )
    return rows
  }
}

export const expenseCategorizationRepository = new ExpenseCategorizationRepository()
