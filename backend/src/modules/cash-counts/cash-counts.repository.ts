import { pool } from '../../config/db'
import type { CashCount, CashCountWithRelations, CashDeposit, CashDepositWithRelations, CashCountListQuery } from './cash-counts.types'
import { CashCountOperationError } from './cash-counts.errors'

const ALLOWED_SORT_FIELDS = new Set([
  'created_at', 'start_date', 'end_date', 'status', 'branch_name', 'system_balance'
])

export class CashCountsRepository {
  // ── Preview ──
  async previewByBranchDate(startDate: string, endDate: string, paymentMethodId: number) {
    const { rows } = await pool.query(
      `SELECT branch_name, transaction_date, nett_amount
       FROM aggregated_transactions
       WHERE payment_method_id = $1
         AND transaction_date >= $2 AND transaction_date <= $3
         AND deleted_at IS NULL AND superseded_by IS NULL`,
      [paymentMethodId, startDate, endDate]
    )

    const grouped: Record<string, { branch_name: string; transaction_date: string; amount: number; count: number }> = {}
    for (const row of rows) {
      const name = row.branch_name || 'Unknown'
      const k = `${name}|${row.transaction_date}`
      if (!grouped[k]) grouped[k] = { branch_name: name, transaction_date: row.transaction_date, amount: 0, count: 0 }
      grouped[k].amount += Number(row.nett_amount) || 0
      grouped[k].count += 1
    }

    return Object.values(grouped)
      .map((v) => ({ branch_name: v.branch_name, transaction_date: v.transaction_date, system_balance: v.amount, transaction_count: v.count }))
      .sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.transaction_date.localeCompare(b.transaction_date))
  }

  async findByPeriod(companyId: string, startDate: string, endDate: string, paymentMethodId: number): Promise<CashCount[]> {
    const { rows } = await pool.query(
      `SELECT * FROM cash_counts
       WHERE company_id = $1 AND start_date >= $2 AND end_date <= $3
         AND payment_method_id = $4 AND deleted_at IS NULL`,
      [companyId, startDate, endDate, paymentMethodId]
    )
    return rows
  }

  // ── Calculate ──
  async calculateSystemBalance(companyId: string, startDate: string, endDate: string, paymentMethodId: number, branchName?: string | null) {
    const conditions = [
      'payment_method_id = $1',
      'transaction_date >= $2',
      'transaction_date <= $3',
      'deleted_at IS NULL',
      'superseded_by IS NULL',
    ]
    const values: unknown[] = [paymentMethodId, startDate, endDate]
    let idx = 4

    if (branchName) {
      conditions.push(`branch_name = $${idx++}`)
      values.push(branchName)
    }

    const { rows } = await pool.query(
      `SELECT transaction_date, nett_amount FROM aggregated_transactions WHERE ${conditions.join(' AND ')}`,
      values
    )

    const byDate: Record<string, { amount: number; count: number }> = {}
    for (const row of rows) {
      const d = row.transaction_date
      if (!byDate[d]) byDate[d] = { amount: 0, count: 0 }
      byDate[d].amount += Number(row.nett_amount) || 0
      byDate[d].count += 1
    }

    return {
      totalAmount: rows.reduce((s, r) => s + (Number(r.nett_amount) || 0), 0),
      count: rows.length,
      dailyBreakdown: Object.entries(byDate)
        .map(([date, v]) => ({ date, amount: v.amount, count: v.count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }
  }

  // ── Duplicate check ──
  async findDuplicate(companyId: string, startDate: string, endDate: string, paymentMethodId: number, branchName?: string | null): Promise<CashCount | null> {
    const conditions = [
      'company_id = $1', 'start_date = $2', 'end_date = $3',
      'payment_method_id = $4', 'deleted_at IS NULL',
    ]
    const values: unknown[] = [companyId, startDate, endDate, paymentMethodId]
    let idx = 5

    if (branchName) {
      conditions.push(`branch_name = $${idx++}`)
      values.push(branchName)
    } else {
      conditions.push('branch_name IS NULL')
    }

    const { rows } = await pool.query(
      `SELECT * FROM cash_counts WHERE ${conditions.join(' AND ')} LIMIT 1`,
      values
    )
    return rows[0] ?? null
  }

  // ── Create cash count ──
  async create(data: {
    company_id: string; start_date: string; end_date: string; branch_name?: string | null;
    payment_method_id: number; system_balance: number; transaction_count: number; notes?: string; created_by?: string;
  }): Promise<CashCount> {
    const { rows } = await pool.query(
      `INSERT INTO cash_counts (company_id, start_date, end_date, branch_name, payment_method_id, system_balance, transaction_count, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9)
       RETURNING *`,
      [data.company_id, data.start_date, data.end_date, data.branch_name || null,
       data.payment_method_id, data.system_balance, data.transaction_count, data.notes ?? null, data.created_by ?? null]
    )
    return rows[0]
  }

  // ── Shared relation loader (avoid N+1) ──
  private async enrichRelations(rows: CashCount[]): Promise<CashCountWithRelations[]> {
    if (!rows.length) return []

    const pmIds = [...new Set(rows.map(r => r.payment_method_id).filter(Boolean))]
    const empIds = [...new Set(rows.map(r => r.responsible_employee_id).filter(Boolean))] as string[]

    const [pmRes, empRes] = await Promise.all([
      pmIds.length
        ? pool.query(`SELECT id, name FROM payment_methods WHERE id = ANY($1::int[])`, [pmIds])
        : { rows: [] },
      empIds.length
        ? pool.query(`SELECT id, full_name FROM employees WHERE id = ANY($1::uuid[])`, [empIds])
        : { rows: [] },
    ])

    const pmMap = new Map(pmRes.rows.map((p: { id: number; name: string }) => [p.id, p.name]))
    const empMap = new Map(empRes.rows.map((e: { id: string; full_name: string }) => [e.id, e.full_name]))

    return rows.map(row => ({
      ...row,
      branch_name: row.branch_name || null,
      payment_method_name: row.payment_method_id ? pmMap.get(row.payment_method_id) ?? null : null,
      responsible_employee_name: row.responsible_employee_id ? empMap.get(row.responsible_employee_id) ?? null : null,
    }))
  }

  async findByIds(ids: string[]): Promise<CashCountWithRelations[]> {
    if (ids.length === 0) return []
    const { rows } = await pool.query(
      `SELECT * FROM cash_counts WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids]
    )
    return this.enrichRelations(rows)
  }

  async findById(id: string): Promise<CashCountWithRelations | null> {
    const rows = await this.findByIds([id])
    return rows[0] || null
  }

  // ── List ──
  async findAll(companyId: string, pagination: { limit: number; offset: number }, query?: CashCountListQuery) {
    const conditions: string[] = ['company_id = $1', 'deleted_at IS NULL']
    const values: unknown[] = [companyId]
    let idx = 2

    if (query?.branch_name) { conditions.push(`branch_name = $${idx++}`); values.push(query.branch_name) }
    if (query?.payment_method_id) { conditions.push(`payment_method_id = $${idx++}`); values.push(query.payment_method_id) }
    if (query?.status) { conditions.push(`status = $${idx++}`); values.push(query.status) }
    if (query?.start_date) { conditions.push(`start_date >= $${idx++}`); values.push(query.start_date) }
    if (query?.end_date) { conditions.push(`end_date <= $${idx++}`); values.push(query.end_date) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const sortField = query?.sort_by && ALLOWED_SORT_FIELDS.has(query.sort_by) ? query.sort_by : 'created_at'
    const sortOrder = query?.sort_order === 'asc' ? 'ASC' : 'DESC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM cash_counts ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM cash_counts ${where}`, values),
    ])

    return {
      data: await this.enrichRelations(dataRes.rows),
      total: countRes.rows[0]?.total ?? 0,
    }
  }

  // ── Update physical count ──
  async updatePhysicalCount(id: string, largeD: number, smallD: number, systemBalance: number, transactionCount: number, responsibleEmployeeId: string | null, notes: string | undefined, userId?: string): Promise<CashCount> {
    const sets = [
      'large_denomination = $1', 'small_denomination = $2', 'physical_count = $3',
      'system_balance = $4', 'transaction_count = $5', 'responsible_employee_id = $6',
      "status = 'COUNTED'", 'counted_by = $7', 'counted_at = NOW()', 'updated_at = NOW()',
    ]
    const values: unknown[] = [largeD, smallD, largeD + smallD, systemBalance, transactionCount, responsibleEmployeeId, userId ?? null]
    let idx = 8

    if (notes !== undefined) {
      sets.push(`notes = $${idx++}`)
      values.push(notes)
    }

    values.push(id)
    const { rows } = await pool.query(
      `UPDATE cash_counts SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      values
    )
    if (rows.length === 0) throw new CashCountOperationError('update_count', 'Not found')
    return rows[0]
  }

  // ── Close ──
  async close(id: string, userId?: string): Promise<CashCount> {
    const { rows } = await pool.query(
      `UPDATE cash_counts SET status = 'CLOSED', closed_by = $1, closed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [userId ?? null, id]
    )
    if (rows.length === 0) throw new CashCountOperationError('close', 'Not found')
    return rows[0]
  }

  // ── Soft delete ──
  async softDelete(id: string): Promise<void> {
    const { rowCount } = await pool.query(
      `UPDATE cash_counts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    if ((rowCount ?? 0) === 0) throw new CashCountOperationError('delete', 'Not found')
  }

  // ════════════════════════════════════════════
  // CASH DEPOSITS
  // ════════════════════════════════════════════

  async createDeposit(data: {
    company_id: string; deposit_amount: number; large_amount?: number; owner_top_up?: number;
    deposit_date: string; bank_account_id: number;
    reference?: string; branch_name?: string; payment_method_id?: number;
    period_start?: string; period_end?: string; item_count: number; notes?: string; created_by?: string;
  }): Promise<CashDeposit> {
    const { rows } = await pool.query(
      `INSERT INTO cash_deposits (company_id, deposit_amount, large_amount, owner_top_up, deposit_date, bank_account_id, reference, status, branch_name, payment_method_id, period_start, period_end, item_count, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [data.company_id, data.deposit_amount, data.large_amount ?? null, data.owner_top_up ?? 0,
       data.deposit_date, data.bank_account_id, data.reference || null,
       data.branch_name || null, data.payment_method_id || null,
       data.period_start || null, data.period_end || null,
       data.item_count, data.notes || null, data.created_by || null]
    )
    return rows[0]
  }

  async linkCashCountsToDeposit(cashCountIds: string[], depositId: string, _userId?: string): Promise<void> {
    await pool.query(
      `UPDATE cash_counts SET cash_deposit_id = $1, status = 'DEPOSITED', updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND deleted_at IS NULL`,
      [depositId, cashCountIds]
    )
  }

  async findDepositById(id: string): Promise<CashDepositWithRelations | null> {
    const { rows: depRows } = await pool.query(
      `SELECT * FROM cash_deposits WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    if (depRows.length === 0) return null
    const dep = depRows[0]

    let bankName: string | null = null
    if (dep.bank_account_id) {
      const { rows: baRows } = await pool.query(
        `SELECT ba.account_name, b.bank_name
         FROM bank_accounts ba
         LEFT JOIN banks b ON b.id = ba.bank_id
         WHERE ba.id = $1`,
        [dep.bank_account_id]
      )
      if (baRows[0]) bankName = `${baRows[0].bank_name || ''} - ${baRows[0].account_name}`
    }

    const { rows: items } = await pool.query(
      `SELECT * FROM cash_counts WHERE cash_deposit_id = $1 AND deleted_at IS NULL ORDER BY start_date ASC`,
      [id]
    )

    return { ...dep, bank_account_name: bankName, items }
  }

  async listDeposits(companyId: string, pagination: { limit: number; offset: number }) {
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM cash_deposits WHERE company_id = $1 AND deleted_at IS NULL
         ORDER BY deposit_date DESC LIMIT $2 OFFSET $3`,
        [companyId, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM cash_deposits WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
    ])
    return { data: dataRes.rows, total: countRes.rows[0]?.total ?? 0 }
  }

  async getCapitalTopUpReport(companyId: string, startDate: string, endDate: string) {
    const { rows } = await pool.query(
      `SELECT id, deposit_date, deposited_at, branch_name, deposit_amount, large_amount, owner_top_up, status
       FROM cash_deposits
       WHERE company_id = $1 AND deposit_date >= $2 AND deposit_date <= $3
         AND owner_top_up > 0 AND deleted_at IS NULL
       ORDER BY deposit_date DESC`,
      [companyId, startDate, endDate]
    )
    return rows
  }

  async confirmDeposit(depositId: string, proofUrl: string, depositedAt: string, userId?: string): Promise<CashDeposit> {
    const { rows } = await pool.query(
      `UPDATE cash_deposits SET status = 'DEPOSITED', proof_url = $1, deposited_at = $2, deposited_by = $3, updated_at = NOW()
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [proofUrl, depositedAt, userId || null, depositId]
    )
    if (rows.length === 0) throw new CashCountOperationError('confirm_deposit', 'Not found')
    return rows[0]
  }

  async revertDepositToPending(depositId: string): Promise<void> {
    // 1. Revert cash_counts
    await pool.query(
      `UPDATE cash_counts SET status = 'COUNTED', cash_deposit_id = NULL, updated_at = NOW()
       WHERE cash_deposit_id = $1 AND deleted_at IS NULL`,
      [depositId]
    )
    // 2. Hard delete cash_deposits
    await pool.query(`DELETE FROM cash_deposits WHERE id = $1`, [depositId])
  }

  async reconcileDeposit(depositId: string, bankStatementId: string): Promise<void> {
    await pool.query(
      `UPDATE cash_deposits SET status = 'RECONCILED', bank_statement_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [bankStatementId, depositId]
    )
    // Sync via RPC (atomic)
    await pool.query(`SELECT sync_cash_deposit_reconciliation($1::uuid, $2::boolean)`, [depositId, true])
  }

  async unreconciledDeposit(depositId: string): Promise<void> {
    await pool.query(`SELECT sync_cash_deposit_reconciliation($1::uuid, $2::boolean)`, [depositId, false])
  }

  async getDepositedForMatch(startDate: string, endDate: string, bankAccountId?: number): Promise<CashDeposit[]> {
    const conditions = ["status = 'DEPOSITED'", 'deposited_at >= $1', 'deposited_at <= $2', 'deleted_at IS NULL']
    const values: unknown[] = [startDate, endDate]
    let idx = 3

    if (bankAccountId) {
      conditions.push(`bank_account_id = $${idx++}`)
      values.push(bankAccountId)
    }

    const { rows } = await pool.query(
      `SELECT * FROM cash_deposits WHERE ${conditions.join(' AND ')} ORDER BY deposited_at ASC`,
      values
    )
    return rows
  }

  async closeCashCountsByDeposit(depositId: string, userId?: string): Promise<void> {
    await pool.query(
      `UPDATE cash_counts SET status = 'CLOSED', closed_by = $1, closed_at = NOW(), updated_at = NOW()
       WHERE cash_deposit_id = $2 AND deleted_at IS NULL`,
      [userId ?? null, depositId]
    )
  }

  async deleteDeposit(id: string): Promise<void> {
    // Unlink cash counts first
    await pool.query(
      `UPDATE cash_counts SET cash_deposit_id = NULL, status = 'COUNTED', updated_at = NOW()
       WHERE cash_deposit_id = $1 AND deleted_at IS NULL`,
      [id]
    )
    // Soft delete
    await pool.query(
      `UPDATE cash_deposits SET deleted_at = NOW() WHERE id = $1`,
      [id]
    )
  }

  async findBankAccountNames(ids: number[]): Promise<{ id: number; bank_name: string; account_name: string }[]> {
    const { rows } = await pool.query(
      `SELECT ba.id, ba.account_name, b.bank_name FROM bank_accounts ba LEFT JOIN banks b ON b.id = ba.bank_id WHERE ba.id = ANY($1::int[])`,
      [ids]
    )
    return rows
  }
}

export const cashCountsRepository = new CashCountsRepository()
