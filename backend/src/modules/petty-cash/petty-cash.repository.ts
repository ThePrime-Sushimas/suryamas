import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type { Queryable } from '../../types/db.types'
import type { PettyCashRequest, PettyCashExpense, PettyCashSettlement } from './petty-cash.types'
import { PettyCashRequestNotFoundError } from './petty-cash.errors'

export class PettyCashRepository {
  // ─── Transaction Helper ─────────────────────────────────────────────────────

  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // ─── Lookups ────────────────────────────────────────────────────────────────

  async findById(id: string, client?: PoolClient): Promise<PettyCashRequest | null> {
    const db: Queryable = client ?? pool
    const { rows } = await db.query(
      'SELECT * FROM petty_cash_requests WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )
    return rows[0] ?? null
  }

  async findByIdForUpdate(client: PoolClient, id: string): Promise<PettyCashRequest | null> {
    const { rows } = await client.query(
      'SELECT * FROM petty_cash_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [id],
    )
    return rows[0] ?? null
  }

  async findBranchCode(client: PoolClient, branchId: string): Promise<string> {
    const { rows } = await client.query<{ branch_code: string }>(
      'SELECT branch_code FROM branches WHERE id = $1',
      [branchId],
    )
    return rows[0]?.branch_code ?? 'XXX'
  }

  async findActiveDisbursedRequestForUpdate(
    client: PoolClient,
    branchId: string,
  ): Promise<{ id: string; request_number: string } | null> {
    const { rows } = await client.query(
      `SELECT id, request_number FROM petty_cash_requests
       WHERE branch_id = $1 AND status = 'DISBURSED' AND deleted_at IS NULL
       FOR UPDATE
       LIMIT 1`,
      [branchId],
    )
    return rows[0] ?? null
  }

  async coaExistsForCompany(coaId: string, companyId: string, client?: PoolClient): Promise<boolean> {
    const db: Queryable = client ?? pool
    const { rows } = await db.query(
      `SELECT 1 FROM chart_of_accounts
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL AND is_active = true`,
      [coaId, companyId],
    )
    return rows.length > 0
  }

  async findBankCoaId(
    client: PoolClient,
    bankAccountId: number,
    companyId: string,
  ): Promise<string | null> {
    const { rows } = await client.query<{ coa_account_id: string }>(
      `SELECT ba.coa_account_id
       FROM bank_accounts ba
       JOIN chart_of_accounts coa ON coa.id = ba.coa_account_id
       WHERE ba.id = $1 AND coa.company_id = $2
         AND ba.coa_account_id IS NOT NULL AND ba.deleted_at IS NULL`,
      [bankAccountId, companyId],
    )
    return rows[0]?.coa_account_id ?? null
  }

  // ─── Number Generation (advisory lock pattern, same as AP Payments) ─────────

  async generateRequestNumber(
    client: PoolClient,
    companyId: string,
    branchCode: string,
  ): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `PC-${branchCode}-${dateStr}`

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${companyId}-${prefix}`,
    ])

    const { rows } = await client.query(
      `SELECT request_number
       FROM petty_cash_requests
       WHERE company_id = $1
         AND request_number LIKE $2
       ORDER BY request_number DESC
       LIMIT 1
       FOR UPDATE`,
      [companyId, `${prefix}-%`],
    )

    const lastSeq = rows.length > 0
      ? parseInt(rows[0].request_number.split('-').pop() || '0', 10)
      : 0

    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  // ─── Writes ─────────────────────────────────────────────────────────────────

  async create(
    client: PoolClient,
    data: {
      company_id: string
      branch_id: string
      request_number: string
      amount_requested: number
      petty_cash_coa_id: string
      description?: string | null
      created_by: string
    },
  ): Promise<PettyCashRequest> {
    const { rows } = await client.query(
      `INSERT INTO petty_cash_requests
        (company_id, branch_id, request_number, status, amount_requested,
         petty_cash_coa_id, description, submitted_by, submitted_at, created_by, updated_by)
       VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, NOW(), $7, $7)
       RETURNING *`,
      [
        data.company_id,
        data.branch_id,
        data.request_number,
        data.amount_requested,
        data.petty_cash_coa_id,
        data.description ?? null,
        data.created_by,
      ],
    )
    return rows[0]
  }

  async updateStatusToDisbursed(
    client: PoolClient,
    id: string,
    data: {
      amount_disbursed: number
      source_bank_account_id: number
      approved_by: string
    },
  ): Promise<void> {
    await client.query(
      `UPDATE petty_cash_requests
       SET status = 'DISBURSED',
           amount_disbursed = $2,
           source_bank_account_id = $3,
           approved_by = $4,
           approved_at = NOW(),
           updated_by = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [id, data.amount_disbursed, data.source_bank_account_id, data.approved_by],
    )
  }

  async setDisburseJournalId(client: PoolClient, id: string, journalId: string): Promise<void> {
    await client.query(
      'UPDATE petty_cash_requests SET disburse_journal_id = $2, updated_at = NOW() WHERE id = $1',
      [id, journalId],
    )
  }

  async updateStatusToRejected(
    id: string,
    data: { rejected_by: string; rejection_reason: string },
    client?: PoolClient,
  ): Promise<void> {
    const db: Queryable = client ?? pool
    await db.query(
      `UPDATE petty_cash_requests
       SET status = 'REJECTED',
           rejected_by = $2,
           rejected_at = NOW(),
           rejection_reason = $3,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, data.rejected_by, data.rejection_reason],
    )
  }

  // ─── Expense Lookups ────────────────────────────────────────────────────────

  async findExpenseById(id: string, client?: PoolClient): Promise<PettyCashExpense | null> {
    const db: Queryable = client ?? pool
    const { rows } = await db.query(
      'SELECT * FROM petty_cash_expenses WHERE id = $1 AND deleted_at IS NULL',
      [id],
    )
    return rows[0] ?? null
  }

  async findCategoryWithInventoryFlag(
    categoryId: string,
    client?: PoolClient,
  ): Promise<{ id: string; affects_inventory: boolean; default_coa_id: string | null } | null> {
    const db: Queryable = client ?? pool
    const { rows } = await db.query(
      'SELECT id, affects_inventory, default_coa_id FROM categories WHERE id = $1 AND is_deleted = false',
      [categoryId],
    )
    return rows[0] ?? null
  }

  async sumExpensesByRequestId(
    client: PoolClient,
    requestId: string,
    excludeExpenseId?: string,
  ): Promise<number> {
    const condition = excludeExpenseId
      ? 'AND id != $2'
      : ''
    const params: string[] = excludeExpenseId
      ? [requestId, excludeExpenseId]
      : [requestId]
    const { rows } = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM petty_cash_expenses
       WHERE request_id = $1 AND deleted_at IS NULL ${condition}`,
      params,
    )
    return Number(rows[0].total)
  }

  async findDebitCoaByPurposeCode(
    client: PoolClient,
    purposeCode: string,
    companyId: string,
  ): Promise<string | null> {
    const { rows: purposeRows } = await client.query<{ id: string }>(
      `SELECT id FROM accounting_purposes
       WHERE purpose_code = $1 AND company_id = $2
         AND (is_deleted IS NULL OR is_deleted = false)
       LIMIT 1`,
      [purposeCode, companyId],
    )
    if (!purposeRows[0]) return null

    const { rows: mappings } = await client.query<{ account_id: string }>(
      `SELECT apa.account_id
       FROM accounting_purpose_accounts apa
       JOIN chart_of_accounts coa ON coa.id = apa.account_id
       WHERE apa.purpose_id = $1 AND apa.company_id = $2
         AND apa.side = 'DEBIT'
         AND apa.is_active = true AND apa.deleted_at IS NULL
         AND coa.deleted_at IS NULL
       ORDER BY apa.priority ASC
       LIMIT 1`,
      [purposeRows[0].id, companyId],
    )

    return mappings[0]?.account_id ?? null
  }

  // ─── Expense Writes ─────────────────────────────────────────────────────────

  async createExpense(
    client: PoolClient,
    data: {
      request_id: string
      company_id: string
      branch_id: string
      expense_date: string
      amount: number
      description?: string | null
      category_id: string
      sub_category_id?: string | null
      expense_coa_id: string
      product_id?: string | null
      product_uom_id?: string | null
      qty?: number | null
      unit_price?: number | null
      warehouse_id?: string | null
      receipt_url?: string | null
      created_by: string
    },
  ): Promise<PettyCashExpense> {
    const { rows } = await client.query(
      `INSERT INTO petty_cash_expenses
        (request_id, company_id, branch_id, expense_date, amount, description,
         category_id, sub_category_id, expense_coa_id,
         product_id, product_uom_id, qty, unit_price, warehouse_id,
         receipt_url, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
       RETURNING *`,
      [
        data.request_id,
        data.company_id,
        data.branch_id,
        data.expense_date,
        data.amount,
        data.description ?? null,
        data.category_id,
        data.sub_category_id ?? null,
        data.expense_coa_id,
        data.product_id ?? null,
        data.product_uom_id ?? null,
        data.qty ?? null,
        data.unit_price ?? null,
        data.warehouse_id ?? null,
        data.receipt_url ?? null,
        data.created_by,
      ],
    )
    return rows[0]
  }

  async updateExpense(
    client: PoolClient,
    id: string,
    data: Record<string, unknown>,
    userId: string,
  ): Promise<PettyCashExpense> {
    const updates = { ...data, updated_by: userId, updated_at: new Date().toISOString() }
    const keys = Object.keys(updates)
    const values = Object.values(updates)
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')

    const { rows } = await client.query(
      `UPDATE petty_cash_expenses SET ${setClause} WHERE id = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id],
    )
    return rows[0]
  }

  async softDeleteExpense(id: string, userId: string, client?: PoolClient): Promise<void> {
    const db: Queryable = client ?? pool
    await db.query(
      `UPDATE petty_cash_expenses SET deleted_at = NOW(), updated_by = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId],
    )
  }

  // ─── Settlement ─────────────────────────────────────────────────────────────

  async findSettlementByRequestId(client: PoolClient, requestId: string): Promise<PettyCashSettlement | null> {
    const { rows } = await client.query(
      'SELECT * FROM petty_cash_settlements WHERE request_id = $1',
      [requestId],
    )
    return rows[0] ?? null
  }

  async getExpenseCoaGrouped(
    client: PoolClient,
    requestId: string,
  ): Promise<Array<{ expense_coa_id: string; total_amount: number }>> {
    const { rows } = await client.query(
      `SELECT expense_coa_id, SUM(amount)::numeric AS total_amount
       FROM petty_cash_expenses
       WHERE request_id = $1 AND deleted_at IS NULL
       GROUP BY expense_coa_id`,
      [requestId],
    )
    return rows.map(r => ({ expense_coa_id: r.expense_coa_id, total_amount: Number(r.total_amount) }))
  }

  async getInventoryExpenses(
    client: PoolClient,
    requestId: string,
  ): Promise<Array<PettyCashExpense & { affects_inventory: boolean }>> {
    const { rows } = await client.query(
      `SELECT e.*, c.affects_inventory
       FROM petty_cash_expenses e
       JOIN categories c ON c.id = e.category_id
       WHERE e.request_id = $1 AND e.deleted_at IS NULL AND c.affects_inventory = true`,
      [requestId],
    )
    return rows
  }

  async insertSettlement(
    client: PoolClient,
    data: {
      request_id: string
      company_id: string
      branch_id: string
      settlement_date: string
      total_disbursed: number
      total_expenses: number
      remaining_balance: number
      amount_returned: number
      return_bank_account_id?: number | null
      notes?: string | null
      created_by: string
    },
  ): Promise<PettyCashSettlement> {
    const { rows } = await client.query(
      `INSERT INTO petty_cash_settlements
        (request_id, company_id, branch_id, settlement_date,
         total_disbursed, total_expenses, remaining_balance,
         amount_returned, return_bank_account_id, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING *`,
      [
        data.request_id, data.company_id, data.branch_id, data.settlement_date,
        data.total_disbursed, data.total_expenses, data.remaining_balance,
        data.amount_returned, data.return_bank_account_id ?? null,
        data.notes ?? null, data.created_by,
      ],
    )
    return rows[0]
  }

  async updateSettlementJournalAndCarry(
    client: PoolClient,
    id: string,
    journalId: string,
    carriedToId: string | null,
  ): Promise<void> {
    await client.query(
      `UPDATE petty_cash_settlements SET journal_id = $2, carried_to_id = $3, updated_at = NOW() WHERE id = $1`,
      [id, journalId, carriedToId],
    )
  }

  async setExpensesSettlementId(client: PoolClient, requestId: string, settlementId: string): Promise<void> {
    await client.query(
      `UPDATE petty_cash_expenses SET settlement_id = $2, updated_at = NOW()
       WHERE request_id = $1 AND deleted_at IS NULL`,
      [requestId, settlementId],
    )
  }

  async updateStatusToClosed(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE petty_cash_requests
       SET status = 'CLOSED', closed_by = $2, closed_at = NOW(), updated_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, userId],
    )
  }

  async createCarriedRequest(
    client: PoolClient,
    data: {
      company_id: string
      branch_id: string
      request_number: string
      amount_requested: number
      amount_disbursed: number
      carried_amount: number
      carried_from_id: string
      petty_cash_coa_id: string
      source_bank_account_id?: number | null
      disburse_journal_id?: string | null
      created_by: string
    },
  ): Promise<PettyCashRequest> {
    const { rows } = await client.query(
      `INSERT INTO petty_cash_requests
        (company_id, branch_id, request_number, status,
         amount_requested, amount_disbursed, carried_amount, carried_from_id,
         petty_cash_coa_id, source_bank_account_id, disburse_journal_id,
         approved_by, approved_at, created_by, updated_by)
       VALUES ($1, $2, $3, 'DISBURSED', $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $11, $11)
       RETURNING *`,
      [
        data.company_id, data.branch_id, data.request_number,
        data.amount_requested, data.amount_disbursed, data.carried_amount,
        data.carried_from_id, data.petty_cash_coa_id,
        data.source_bank_account_id ?? null, data.disburse_journal_id ?? null,
        data.created_by,
      ],
    )
    return rows[0]
  }

  async updateExpenseStockMovementId(client: PoolClient, expenseId: string, movementId: string): Promise<void> {
    await client.query(
      'UPDATE petty_cash_expenses SET stock_movement_id = $2, updated_at = NOW() WHERE id = $1',
      [expenseId, movementId],
    )
  }

  async updateReceiptUrl(expenseId: string, receiptUrl: string, userId: string, client?: PoolClient): Promise<void> {
    const db: Queryable = client ?? pool
    await db.query(
      `UPDATE petty_cash_expenses
       SET receipt_url = $1, updated_by = $2, updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL`,
      [receiptUrl, userId, expenseId],
    )
  }

  // ─── Settlement Void ────────────────────────────────────────────────────────

  async findSettlementById(id: string, client?: PoolClient): Promise<PettyCashSettlement | null> {
    const db: Queryable = client ?? pool
    const { rows } = await db.query(
      'SELECT * FROM petty_cash_settlements WHERE id = $1',
      [id],
    )
    return rows[0] ?? null
  }

  async countExpensesByRequestId(requestId: string, client?: PoolClient): Promise<number> {
    const db: Queryable = client ?? pool
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM petty_cash_expenses WHERE request_id = $1 AND deleted_at IS NULL',
      [requestId],
    )
    return rows[0]?.count ?? 0
  }

  async findCarriedRequestForUpdate(
    client: PoolClient,
    carriedToId: string,
  ): Promise<{ id: string; disburse_journal_id: string | null } | null> {
    const { rows } = await client.query(
      'SELECT id, disburse_journal_id FROM petty_cash_requests WHERE id = $1 FOR UPDATE',
      [carriedToId],
    )
    return rows[0] ?? null
  }

  async findStockMovementById(
    client: PoolClient,
    movementId: string,
  ): Promise<{ id: string; warehouse_id: string; product_id: string; qty: number; cost_per_unit: number; movement_date: string } | null> {
    const { rows } = await client.query(
      'SELECT id, warehouse_id, product_id, qty, cost_per_unit, movement_date::text AS movement_date FROM stock_movements WHERE id = $1',
      [movementId],
    )
    return rows[0] ?? null
  }

  async getExpensesWithMovements(
    client: PoolClient,
    requestId: string,
  ): Promise<Array<{ id: string; stock_movement_id: string }>> {
    const { rows } = await client.query(
      `SELECT id, stock_movement_id FROM petty_cash_expenses
       WHERE request_id = $1 AND deleted_at IS NULL AND stock_movement_id IS NOT NULL`,
      [requestId],
    )
    return rows
  }

  async clearExpenseStockMovementId(client: PoolClient, expenseId: string): Promise<void> {
    await client.query(
      'UPDATE petty_cash_expenses SET stock_movement_id = NULL, updated_at = NOW() WHERE id = $1',
      [expenseId],
    )
  }

  async clearExpensesSettlementId(client: PoolClient, requestId: string): Promise<void> {
    await client.query(
      `UPDATE petty_cash_expenses SET settlement_id = NULL, updated_at = NOW()
       WHERE request_id = $1 AND deleted_at IS NULL`,
      [requestId],
    )
  }

  async hardDeleteSettlement(client: PoolClient, id: string): Promise<void> {
    await client.query('DELETE FROM petty_cash_settlements WHERE id = $1', [id])
  }

  async hardDeleteRequest(client: PoolClient, id: string): Promise<void> {
    await client.query('DELETE FROM petty_cash_requests WHERE id = $1', [id])
  }

  async revertRequestToDisbursed(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE petty_cash_requests
       SET status = 'DISBURSED', closed_by = NULL, closed_at = NULL,
           updated_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, userId],
    )
  }

  // ─── Query Layer ────────────────────────────────────────────────────────────

  private static ALLOWED_SORT_FIELDS = ['request_number', 'created_at', 'amount_requested', 'amount_disbursed', 'status']

  async findAll(
    filter: {
      branch_id?: string
      status?: string
      date_from?: string
      date_to?: string
      search?: string
      page?: number
      limit?: number
      sort_by?: string
      sort_order?: string
    },
    branchIds: string[],
  ): Promise<{ data: any[]; total: number }> {
    const conditions: string[] = [
      'r.branch_id = ANY($1::uuid[])',
      'r.deleted_at IS NULL',
    ]
    const params: unknown[] = [branchIds]
    let idx = 2

    if (filter.branch_id) {
      conditions.push(`r.branch_id = $${idx++}`)
      params.push(filter.branch_id)
    }
    if (filter.status) {
      conditions.push(`r.status = $${idx++}`)
      params.push(filter.status)
    }
    if (filter.date_from) {
      conditions.push(`r.created_at::date >= $${idx++}::date`)
      params.push(filter.date_from)
    }
    if (filter.date_to) {
      conditions.push(`r.created_at::date <= $${idx++}::date`)
      params.push(filter.date_to)
    }
    if (filter.search) {
      conditions.push(`(r.request_number ILIKE $${idx} OR r.description ILIKE $${idx})`)
      params.push(`%${filter.search}%`)
      idx++
    }

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const limit = filter.limit ?? 25
    const offset = (page - 1) * limit

    const sortField = filter.sort_by && PettyCashRepository.ALLOWED_SORT_FIELDS.includes(filter.sort_by)
      ? `r.${filter.sort_by}`
      : 'r.created_at'
    const sortOrder = filter.sort_order === 'asc' ? 'ASC' : 'DESC'

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM petty_cash_requests r WHERE ${where}`,
      params,
    )
    const total = countResult.rows[0].total

    const { rows } = await pool.query(
      `SELECT
         r.*,
         b.branch_name,
         coa.account_name AS petty_cash_coa_name,
         e_sub.full_name AS submitted_by_name,
         e_apr.full_name AS approved_by_name,
         CASE WHEN s.id IS NOT NULL THEN 'SETTLED' ELSE NULL END AS settlement_status,
         (COALESCE(r.amount_disbursed, 0) + r.carried_amount) AS total_disbursed,
         COALESCE(exp_sum.total_expenses, 0)::numeric AS total_expenses
       FROM petty_cash_requests r
       JOIN branches b ON b.id = r.branch_id
       JOIN chart_of_accounts coa ON coa.id = r.petty_cash_coa_id
       LEFT JOIN employees e_sub ON e_sub.user_id = r.submitted_by
       LEFT JOIN employees e_apr ON e_apr.user_id = r.approved_by
       LEFT JOIN petty_cash_settlements s ON s.request_id = r.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS total_expenses
         FROM petty_cash_expenses
         WHERE request_id = r.id AND deleted_at IS NULL
       ) exp_sum ON true
       WHERE ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    )

    return { data: rows, total }
  }

  async findByIdWithDetails(id: string, branchIds: string[]): Promise<any> {
    const { rows: headerRows } = await pool.query(
      `SELECT
         r.*,
         b.branch_name,
         coa.account_name AS petty_cash_coa_name,
         e_sub.full_name AS submitted_by_name,
         e_apr.full_name AS approved_by_name,
         e_rej.full_name AS rejected_by_name,
         e_cls.full_name AS closed_by_name,
         e_cre.full_name AS created_by_name,
         ba.account_name AS source_bank_account_name,
         bk.bank_name AS source_bank_name,
         s.id AS settlement_id,
         CASE WHEN s.id IS NOT NULL THEN 'SETTLED' ELSE NULL END AS settlement_status,
         (COALESCE(r.amount_disbursed, 0) + r.carried_amount) AS total_disbursed,
         COALESCE(exp_sum.total_expenses, 0)::numeric AS total_expenses
       FROM petty_cash_requests r
       JOIN branches b ON b.id = r.branch_id
       JOIN chart_of_accounts coa ON coa.id = r.petty_cash_coa_id
       LEFT JOIN employees e_sub ON e_sub.user_id = r.submitted_by
       LEFT JOIN employees e_apr ON e_apr.user_id = r.approved_by
       LEFT JOIN employees e_rej ON e_rej.user_id = r.rejected_by
       LEFT JOIN employees e_cls ON e_cls.user_id = r.closed_by
       LEFT JOIN employees e_cre ON e_cre.user_id = r.created_by
       LEFT JOIN bank_accounts ba ON ba.id = r.source_bank_account_id
       LEFT JOIN banks bk ON bk.id = ba.bank_id
       LEFT JOIN petty_cash_settlements s ON s.request_id = r.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS total_expenses
         FROM petty_cash_expenses
         WHERE request_id = r.id AND deleted_at IS NULL
       ) exp_sum ON true
       WHERE r.id = $1 AND r.branch_id = ANY($2::uuid[]) AND r.deleted_at IS NULL`,
      [id, branchIds],
    )

    if (!headerRows[0]) return null

    const { rows: expenses } = await pool.query(
      `SELECT e.*,
         c.category_name, c.category_code, c.affects_inventory,
         sc.sub_category_name,
         p.product_name, p.product_code,
         coa_e.account_name AS expense_coa_name,
         w.warehouse_name,
         e_cre.full_name AS created_by_name
       FROM petty_cash_expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN sub_categories sc ON sc.id = e.sub_category_id
       LEFT JOIN products p ON p.id = e.product_id
       LEFT JOIN chart_of_accounts coa_e ON coa_e.id = e.expense_coa_id
       LEFT JOIN warehouses w ON w.id = e.warehouse_id
       LEFT JOIN employees e_cre ON e_cre.user_id = e.created_by
       WHERE e.request_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.expense_date ASC, e.created_at ASC`,
      [id],
    )

    return { ...headerRows[0], expenses }
  }

  async findExpensesByRequestId(
    requestId: string,
    filter: { page: number; limit: number },
    branchIds: string[],
  ): Promise<{ data: any[]; total: number }> {
    // Access check
    const { rows: reqRows } = await pool.query(
      'SELECT branch_id FROM petty_cash_requests WHERE id = $1 AND deleted_at IS NULL',
      [requestId],
    )
    if (!reqRows[0] || !branchIds.includes(reqRows[0].branch_id)) {
      throw new PettyCashRequestNotFoundError(requestId)
    }

    const offset = (filter.page - 1) * filter.limit

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM petty_cash_expenses WHERE request_id = $1 AND deleted_at IS NULL',
      [requestId],
    )
    const total = countResult.rows[0].total

    const { rows } = await pool.query(
      `SELECT e.*,
         c.category_name, c.category_code, c.affects_inventory,
         sc.sub_category_name,
         p.product_name, p.product_code,
         coa_e.account_name AS expense_coa_name,
         w.warehouse_name,
         e_cre.full_name AS created_by_name
       FROM petty_cash_expenses e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN sub_categories sc ON sc.id = e.sub_category_id
       LEFT JOIN products p ON p.id = e.product_id
       LEFT JOIN chart_of_accounts coa_e ON coa_e.id = e.expense_coa_id
       LEFT JOIN warehouses w ON w.id = e.warehouse_id
       LEFT JOIN employees e_cre ON e_cre.user_id = e.created_by
       WHERE e.request_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.expense_date ASC, e.created_at ASC
       LIMIT $2 OFFSET $3`,
      [requestId, filter.limit, offset],
    )

    return { data: rows, total }
  }

  async findExpensesForReport(
    filter: { branch_id?: string; date_from?: string; date_to?: string; search?: string; limit?: number },
    branchIds: string[],
  ): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number } }> {
    const conditions: string[] = [
      'e.deleted_at IS NULL',
      'r.deleted_at IS NULL',
      'r.branch_id = ANY($1::uuid[])',
    ]
    const params: unknown[] = [branchIds]
    let idx = 2

    if (filter.branch_id) {
      conditions.push(`r.branch_id = $${idx++}`)
      params.push(filter.branch_id)
    }
    if (filter.date_from) {
      conditions.push(`e.expense_date >= $${idx++}::date`)
      params.push(filter.date_from)
    }
    if (filter.date_to) {
      conditions.push(`e.expense_date <= $${idx++}::date`)
      params.push(filter.date_to)
    }
    if (filter.search) {
      conditions.push(`(r.request_number ILIKE $${idx} OR e.description ILIKE $${idx})`)
      params.push(`%${filter.search}%`)
      idx++
    }

    const where = conditions.join(' AND ')
    const effectiveLimit = filter.limit === -1 ? null : (filter.limit ?? 100)

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM petty_cash_expenses e
       JOIN petty_cash_requests r ON r.id = e.request_id
       WHERE ${where}`,
      params,
    )
    const total = countResult.rows[0].total

    const limitClause = effectiveLimit !== null ? `LIMIT $${idx}` : ''
    const dataParams = effectiveLimit !== null ? [...params, effectiveLimit] : params

    const { rows } = await pool.query(
      `SELECT
         e.id, e.request_id, e.expense_date, e.amount, e.description,
         r.request_number, r.status AS request_status,
         b.branch_name,
         c.category_name, c.category_code, c.affects_inventory,
         sc.sub_category_name,
         p.product_name,
         coa.account_name AS petty_cash_coa_name,
         (COALESCE(r.amount_disbursed, 0) + r.carried_amount) AS request_total_disbursed,
         (COALESCE(r.amount_disbursed, 0) + r.carried_amount) - COALESCE(exp_sum.total, 0)
           AS request_remaining,
         CASE WHEN s.id IS NOT NULL THEN 'SETTLED' ELSE NULL END AS settlement_status
       FROM petty_cash_expenses e
       JOIN petty_cash_requests r ON r.id = e.request_id
       JOIN branches b ON b.id = r.branch_id
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN sub_categories sc ON sc.id = e.sub_category_id
       LEFT JOIN products p ON p.id = e.product_id
       JOIN chart_of_accounts coa ON coa.id = r.petty_cash_coa_id
       LEFT JOIN petty_cash_settlements s ON s.request_id = r.id
       LEFT JOIN LATERAL (
         SELECT SUM(ex.amount) AS total
         FROM petty_cash_expenses ex
         WHERE ex.request_id = r.id AND ex.deleted_at IS NULL
       ) exp_sum ON true
       WHERE ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC
       ${limitClause}`,
      dataParams,
    )

    return { data: rows, pagination: { total, page: 1, limit: effectiveLimit ?? total } }
  }
}

export const pettyCashRepository = new PettyCashRepository()
