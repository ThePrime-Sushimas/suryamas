import { pool } from '../../../config/db'
import { DatabaseError } from '../../../utils/error-handler.util'
import { 
  AggregatedTransaction, 
  AggregatedTransactionWithDetails,
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionStatus,
  AggregatedTransactionSourceType
} from './pos-aggregates.types'
import { AggregatedTransactionErrors } from './pos-aggregates.errors'

/**
 * Helper function to normalize branch_names filter (handle both string and array)
 */
function normalizeStringArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  // Handle comma-separated string
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * Helper function to normalize number IDs filter (handle both string and array)
 */
function normalizeNumberArray(value: string | number[] | undefined): number[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value.filter(n => typeof n === 'number' && !isNaN(n))
  // Handle comma-separated string
  return value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
}

export class PosAggregatesRepository {
  /**
   * Find all aggregated transactions with pagination and filters
   */
  async findAll(
    pagination: { limit: number; offset: number },
    filter?: AggregatedTransactionFilterParams,
    sort?: AggregatedTransactionSortParams
  ): Promise<{ data: AggregatedTransactionListItem[]; total: number }> {
    const conditions: string[] = []
    const params: any[] = []

    // Base conditions
    conditions.push('at.superseded_by IS NULL')
    if (!filter?.show_deleted) {
      conditions.push('at.deleted_at IS NULL')
    }

    // Apply filters
    if (filter?.branch_id) {
      params.push(filter.branch_id)
      conditions.push(`at.branch_id = $${params.length}`)
    }

    if (filter?.branch_name !== undefined) {
      if (filter.branch_name === null) {
        conditions.push('at.branch_name IS NULL')
      } else {
        params.push(filter.branch_name)
        conditions.push(`at.branch_name = $${params.length}`)
      }
    }

    const branchNamesArray = normalizeStringArray(filter?.branch_names)
    if (branchNamesArray && branchNamesArray.length > 0) {
      const orConditions = branchNamesArray.map(b => {
        params.push(`%${b}%`)
        return `at.branch_name ILIKE $${params.length}`
      }).join(' OR ')
      conditions.push(`(${orConditions})`)
    }

    if (filter?.source_type) {
      params.push(filter.source_type)
      conditions.push(`at.source_type = $${params.length}`)
    }

    if (filter?.source_id) {
      params.push(filter.source_id)
      conditions.push(`at.source_id = $${params.length}`)
    }

    if (filter?.payment_method_id) {
      params.push(filter.payment_method_id)
      conditions.push(`at.payment_method_id = $${params.length}`)
    }

    const paymentMethodIdsArray = normalizeNumberArray(filter?.payment_method_ids)
    if (paymentMethodIdsArray && paymentMethodIdsArray.length > 0) {
      params.push(paymentMethodIdsArray)
      conditions.push(`at.payment_method_id = ANY($${params.length})`)
    }

    if (filter?.transaction_date) {
      params.push(filter.transaction_date)
      conditions.push(`at.transaction_date = $${params.length}::date`)
    }

    if (filter?.transaction_date_from) {
      params.push(filter.transaction_date_from)
      conditions.push(`at.transaction_date >= $${params.length}::date`)
    }

    if (filter?.transaction_date_to) {
      params.push(filter.transaction_date_to)
      conditions.push(`at.transaction_date <= $${params.length}::date`)
    }

    if (filter?.status) {
      params.push(filter.status)
      conditions.push(`at.status = $${params.length}`)
    }

    if (filter?.is_reconciled !== undefined) {
      params.push(filter.is_reconciled)
      conditions.push(`at.is_reconciled = $${params.length}`)
    }

    if (filter?.has_journal !== undefined) {
      if (filter.has_journal) {
        conditions.push('at.journal_id IS NOT NULL')
      } else {
        conditions.push('at.journal_id IS NULL')
      }
    }

    if (filter?.search) {
      params.push(`%${filter.search}%`)
      const idx = params.length
      conditions.push(`(at.source_ref ILIKE $${idx} OR at.branch_name ILIKE $${idx})`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Sorting
    let orderBy = 'ORDER BY at.transaction_date DESC, at.created_at DESC'
    if (sort) {
      const validSortFields = ['transaction_date', 'created_at', 'gross_amount', 'nett_amount', 'status', 'branch_name']
      const field = validSortFields.includes(sort.field) ? sort.field : 'transaction_date'
      const order = sort.order === 'desc' ? 'DESC' : 'ASC'
      orderBy = `ORDER BY at.${field} ${order}`
    }

    try {
      const dataQuery = `
        SELECT at.*, pm.code as pm_code, pm.name as pm_name
        FROM aggregated_transactions at
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        ${where}
        ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `
      const countQuery = `
        SELECT COUNT(*)::int as total
        FROM aggregated_transactions at
        ${where}
      `

      const [dataRes, countRes] = await Promise.all([
        pool.query(dataQuery, [...params, pagination.limit, pagination.offset]),
        pool.query(countQuery, params)
      ])

      const mapped = dataRes.rows.map(item => this.mapToListItem({
        ...item,
        payment_methods: item.payment_method_id ? { id: item.payment_method_id, code: item.pm_code, name: item.pm_name } : null
      }))

      return { data: mapped, total: countRes.rows[0].total }
    } catch (error: any) {
      throw new DatabaseError('Failed to fetch aggregated transactions', { cause: error })
    }
  }

  /**
   * Find single aggregated transaction by ID
   */
  async findById(id: string): Promise<AggregatedTransactionWithDetails | null> {
    try {
      // 1. Get aggregated transaction
      const aggQuery = `
        SELECT at.*, 
          pm.id as pm_id, pm.code as pm_code, pm.name as pm_name,
          jh.id as jh_id, jh.journal_number, jh.status as jh_status, jh.is_auto
        FROM aggregated_transactions at
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        LEFT JOIN journal_headers jh ON at.journal_id = jh.id
        WHERE at.id = $1 AND at.deleted_at IS NULL AND at.superseded_by IS NULL
      `
      const { rows: aggRows } = await pool.query(aggQuery, [id])
      const aggData = aggRows[0]
      if (!aggData) return null

      // Attach payment_methods and journal nested objects for mapToWithDetails
      aggData.payment_methods = aggData.pm_id ? { id: aggData.pm_id, code: aggData.pm_code, name: aggData.pm_name } : null
      aggData.journal = aggData.jh_id ? { id: aggData.jh_id, journal_number: aggData.journal_number, status: aggData.jh_status, is_auto: aggData.is_auto } : null

      // 2. Get bank statement via reconciliation_id
      const bankQuery = `
        SELECT bs.id, bs.transaction_date, bs.description, bs.debit_amount, bs.credit_amount, bs.is_reconciled,
          ba.account_name, ba.account_number, b.bank_name, b.bank_code
        FROM bank_statements bs
        LEFT JOIN bank_accounts ba ON bs.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        WHERE bs.reconciliation_id = $1 AND bs.deleted_at IS NULL
        LIMIT 1
      `
      const { rows: bankRows } = await pool.query(bankQuery, [id])
      const bankDataRaw = bankRows[0]
      let bankData = null
      if (bankDataRaw) {
        bankData = {
          ...bankDataRaw,
          bank_accounts: {
            account_name: bankDataRaw.account_name,
            account_number: bankDataRaw.account_number,
            banks: {
              bank_name: bankDataRaw.bank_name,
              bank_code: bankDataRaw.bank_code
            }
          }
        }
      }

      // 3. Query settlement group
      const settlementQuery = `
        SELECT bsa.settlement_group_id,
          bsg.id, bsg.settlement_number, bsg.settlement_date, bsg.status, bsg.bank_name,
          bs.id as statement_id, bs.description, bs.credit_amount, bs.debit_amount
        FROM bank_settlement_aggregates bsa
        JOIN bank_settlement_groups bsg ON bsa.settlement_group_id = bsg.id
        LEFT JOIN bank_statements bs ON bsg.bank_statement_id = bs.id
        WHERE bsa.aggregate_id = $1
        LIMIT 1
      `
      const { rows: settleRows } = await pool.query(settlementQuery, [id])
      let settlementAgg = null
      if (settleRows[0]) {
        const s = settleRows[0]
        settlementAgg = {
          settlement_group_id: s.settlement_group_id,
          bank_settlement_groups: {
            id: s.id,
            settlement_number: s.settlement_number,
            settlement_date: s.settlement_date,
            status: s.status,
            bank_name: s.bank_name,
            bank_statements: s.statement_id ? [{ id: s.statement_id, description: s.description, credit_amount: s.credit_amount, debit_amount: s.debit_amount }] : []
          }
        }
      }

      // 4. Query multi-match group
      const multiMatchQuery = `
        SELECT brg.id, brg.status, brg.difference, brg.total_bank_amount, brg.aggregate_amount,
          brgd.statement_id, brgd.amount as match_amount,
          bs.id as bs_id, bs.description, bs.credit_amount, bs.debit_amount, bs.transaction_date as bs_date
        FROM bank_reconciliation_groups brg
        LEFT JOIN bank_reconciliation_group_details brgd ON brg.id = brgd.group_id
        LEFT JOIN bank_statements bs ON brgd.statement_id = bs.id
        WHERE brg.aggregate_id = $1 AND brg.deleted_at IS NULL
      `
      const { rows: multiRows } = await pool.query(multiMatchQuery, [id])
      let multiMatchAgg = null
      if (multiRows.length > 0) {
        multiMatchAgg = {
          id: multiRows[0].id,
          status: multiRows[0].status,
          difference: multiRows[0].difference,
          total_bank_amount: multiRows[0].total_bank_amount,
          aggregate_amount: multiRows[0].aggregate_amount,
          bank_reconciliation_group_details: multiRows.map(r => ({
            statement_id: r.statement_id,
            amount: r.match_amount,
            bank_statements: r.bs_id ? { id: r.bs_id, description: r.description, credit_amount: r.credit_amount, debit_amount: r.debit_amount, transaction_date: r.bs_date } : null
          })).filter(d => d.statement_id)
        }
      }

      // 5. Query cash deposit match
      let cashDepositData: Record<string, unknown> | null = null
      if (aggData.is_reconciled && !bankData && !settlementAgg) {
        const depositMatchQuery = `
          SELECT bs.id as bs_id, bs.transaction_date as bs_date, bs.description as bs_desc, bs.credit_amount as bs_credit, bs.debit_amount as bs_debit,
            cd.id as cd_id, cd.deposit_amount, cd.deposit_date, cd.branch_name, cd.status, cd.proof_url, cd.deposited_at, cd.bank_account_id
          FROM bank_statements bs
          JOIN cash_deposits cd ON bs.cash_deposit_id = cd.id
          JOIN cash_counts cc ON cd.id = cc.cash_deposit_id
          WHERE cd.branch_name = $1
            AND cc.payment_method_id = $2
            AND cc.start_date <= $3 AND cc.end_date >= $3
            AND bs.deleted_at IS NULL AND cc.deleted_at IS NULL
          LIMIT 1
        `
        const { rows: depositRows } = await pool.query(depositMatchQuery, [aggData.branch_name, aggData.payment_method_id, aggData.transaction_date])
        if (depositRows[0]) {
          const d = depositRows[0]
          cashDepositData = {
            cash_deposit_id: d.cd_id,
            deposit_amount: d.deposit_amount,
            deposit_date: d.deposit_date,
            deposit_branch_name: d.branch_name,
            deposit_status: d.status,
            deposit_proof_url: d.proof_url,
            deposit_deposited_at: d.deposited_at,
            bank_statement_id: d.bs_id,
            bank_statement_date: d.bs_date,
            bank_statement_description: d.bs_desc,
            bank_statement_amount: (Number(d.bs_credit) || 0) - (Number(d.bs_debit) || 0),
          }
        }
      }

      return this.mapToWithDetails(aggData, bankData || null, settlementAgg || null, multiMatchAgg || null, cashDepositData)
    } catch (error: any) {
      throw new DatabaseError('Failed to fetch aggregated transaction', { cause: error })
    }
  }

  /**
   * Find aggregated transaction by source composite key
   */
  async findBySource(
    sourceType: string, 
    sourceId: string, 
    sourceRef: string
  ): Promise<AggregatedTransaction | null> {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM aggregated_transactions WHERE source_type = $1 AND source_id = $2 AND source_ref = $3 AND deleted_at IS NULL',
        [sourceType, sourceId, sourceRef]
      )
      return rows[0] || null
    } catch (error: any) {
      throw new DatabaseError('Failed to find transaction by source', { cause: error })
    }
  }

  /**
   * Check if source already exists
   */
  async sourceExists(
    sourceType: string, 
    sourceId: string, 
    sourceRef: string,
    excludeId?: string
  ): Promise<boolean> {
    try {
      const params: any[] = [sourceType, sourceId, sourceRef]
      let query = 'SELECT COUNT(*)::int as count FROM aggregated_transactions WHERE source_type = $1 AND source_id = $2 AND source_ref = $3 AND deleted_at IS NULL'
      if (excludeId) {
        params.push(excludeId)
        query += ` AND id != $${params.length}`
      }
      const { rows } = await pool.query(query, params)
      return rows[0].count > 0
    } catch (error: any) {
      throw new DatabaseError('Failed to check source existence', { cause: error })
    }
  }

  /**
   * Create new aggregated transaction
   */
  async create(data: Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<AggregatedTransaction> {
    try {
      const keys = Object.keys(data)
      const values = Object.values(data)
      const cols = keys.join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const { rows } = await pool.query(
        `INSERT INTO aggregated_transactions (${cols}) VALUES (${placeholders}) RETURNING *`,
        values
      )
      return rows[0]
    } catch (error: any) {
      if (error.code === '23505') {
        throw AggregatedTransactionErrors.DUPLICATE_SOURCE()
      }
      throw new DatabaseError('Failed to create aggregated transaction', { cause: error })
    }
  }

  /**
   * Create multiple aggregated transactions (TRUE BULK INSERT)
   */
  async createBatchBulk(
    transactions: Array<Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>>,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ 
    success: string[] 
    failed: Array<{ source_ref: string; error: string }>
    total_processed: number
  }> {
    const BATCH_SIZE = 100
    const success: string[] = []
    const failed: Array<{ source_ref: string; error: string }> = []
    
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE)
      if (onProgress) onProgress(i, transactions.length)

      try {
        const columns = [
          'branch_id', 'branch_name', 'source_type', 'source_id', 'source_ref', 
          'transaction_date', 'payment_method_id', 'gross_amount', 'discount_amount', 
          'tax_amount', 'service_charge_amount', 'bill_after_discount', 
          'percentage_fee_amount', 'fixed_fee_amount', 'total_fee_amount', 
          'nett_amount', 'rounding_amount', 'delivery_cost', 'order_fee', 
          'voucher_discount_amount', 'promotion_discount_amount', 'menu_discount_amount', 
          'voucher_payment_amount', 'other_vat_amount', 'pax_total', 'currency', 
          'journal_id', 'is_reconciled', 'status', 'deleted_at', 'deleted_by', 
          'failed_at', 'failed_reason'
        ]
        const cols = columns.join(', ')
        const values: any[] = []
        const placeholders = batch.map((tx, txIdx) => {
          const rowPlaceholders = columns.map((col, colIdx) => {
            values.push((tx as any)[col] ?? null)
            return `$${txIdx * columns.length + colIdx + 1}`
          })
          return `(${rowPlaceholders.join(', ')})`
        }).join(', ')

        const { rows } = await pool.query(
          `INSERT INTO aggregated_transactions (${cols}) VALUES ${placeholders} RETURNING source_ref`,
          values
        )
        rows.forEach(r => success.push(r.source_ref))
      } catch (error: any) {
        // Fallback: one-by-one
        for (const tx of batch) {
          try {
            await this.create(tx)
            success.push(tx.source_ref)
          } catch (err: any) {
            failed.push({
              source_ref: tx.source_ref,
              error: err.message || 'Unknown error'
            })
          }
        }
      }
    }

    if (onProgress) onProgress(transactions.length, transactions.length)

    return { success, failed, total_processed: transactions.length }
  }

  /**
   * Create failed transaction record
   */
  async createFailedTransaction(
    data: Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>,
    failedReason: string
  ): Promise<AggregatedTransaction> {
    const failedData = {
      ...data,
      status: 'FAILED' as AggregatedTransactionStatus,
      failed_at: new Date().toISOString(),
      failed_reason: failedReason,
    }
    return this.create(failedData)
  }

  /**
   * Create multiple failed transactions (bulk)
   */
  async createFailedBatch(
    transactions: Array<{
      data: Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>
      error: string
    }>
  ): Promise<{ created: number; failed: number }> {
    const records = transactions.map(tx => ({
      ...tx.data,
      status: 'FAILED' as AggregatedTransactionStatus,
      failed_at: new Date().toISOString(),
      failed_reason: tx.error,
    }))
    
    const result = await this.createBatchBulk(records)
    return { created: result.success.length, failed: result.failed.length }
  }

  /**
   * Update aggregated transaction
   */
  async update(
    id: string, 
    updates: Partial<AggregatedTransaction>,
    expectedVersion?: number
  ): Promise<AggregatedTransaction> {
    try {
      const keys = Object.keys(updates)
      const values = Object.values(updates)
      
      const newVersion = (expectedVersion || 0) + 1
      keys.push('version', 'updated_at')
      values.push(newVersion, new Date().toISOString())

      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
      
      let query = `UPDATE aggregated_transactions SET ${setClause} WHERE id = $${keys.length + 1}`
      const queryParams = [...values, id]

      if (expectedVersion !== undefined) {
        queryParams.push(expectedVersion)
        query += ` AND version = $${queryParams.length}`
      }

      query += ' RETURNING *'
      
      const { rows } = await pool.query(query, queryParams)
      if (rows.length === 0) {
        if (expectedVersion !== undefined) {
          throw AggregatedTransactionErrors.VERSION_CONFLICT(id, expectedVersion, newVersion)
        }
        throw new DatabaseError('Aggregated transaction not found or version conflict')
      }
      return rows[0]
    } catch (error: any) {
      if (error instanceof DatabaseError || error.name === 'AggregatedTransactionError') throw error
      throw new DatabaseError('Failed to update aggregated transaction', { cause: error })
    }
  }

  /**
   * Soft delete aggregated transaction
   */
  async softDelete(id: string, deletedBy?: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET deleted_at = $1, deleted_by = $2, updated_at = $1 WHERE id = $3 AND deleted_at IS NULL',
        [new Date().toISOString(), deletedBy || null, id]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to delete aggregated transaction', { cause: error })
    }
  }

  /**
   * Restore soft-deleted transaction
   */
  async restore(id: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET deleted_at = NULL, deleted_by = NULL, updated_at = $1 WHERE id = $2 AND deleted_at IS NOT NULL',
        [new Date().toISOString(), id]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to restore aggregated transaction', { cause: error })
    }
  }

  /**
   * Update journal_id for transaction
   */
  async assignJournal(id: string, journalId: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET journal_id = $1, status = \'PROCESSING\', updated_at = $2 WHERE id = $3',
        [journalId, new Date().toISOString(), id]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to assign journal', { cause: error })
    }
  }

  /**
   * Update journal_id for multiple transactions (batch)
   */
  async assignJournalBatch(
    transactionIds: string[], 
    journalId: string
  ): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET journal_id = $1, status = \'PROCESSING\', updated_at = $2 WHERE id = ANY($3)',
        [journalId, new Date().toISOString(), transactionIds]
      )
    } catch (error: any) {
      if (error) throw new DatabaseError('Failed to assign journal to transactions', { cause: error })
    }
  }

  async findExistingSync(params: {
    transaction_date: string,
    payment_method_id: number,
    branch_id?: string | null,
    branch_name?: string | null
  }): Promise<{ id: string } | null> {
    try {
      const conditions: string[] = [
        'source_type = \'POS_SYNC\'',
        'transaction_date = $1::date',
        'payment_method_id = $2',
        'deleted_at IS NULL',
        'superseded_by IS NULL'
      ]
      const values: any[] = [params.transaction_date, params.payment_method_id]

      if (params.branch_id) {
        values.push(params.branch_id)
        conditions.push(`branch_id = $${values.length}`)
      } else if (params.branch_name) {
        values.push(params.branch_name)
        conditions.push(`branch_name = $${values.length}`)
      }

      const { rows } = await pool.query(
        `SELECT id FROM aggregated_transactions WHERE ${conditions.join(' AND ')} LIMIT 1`,
        values
      )
      return rows[0] || null
    } catch (error: any) {
      throw new DatabaseError('Failed to find existing POS sync', { cause: error })
    }
  }

  async setSuperseded(id: string, supersededById: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET superseded_by = $1, status = \'SUPERSEDED\', updated_at = $2 WHERE id = $3',
        [supersededById, new Date().toISOString(), id]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to set superseded status', { cause: error })
    }
  }

  /**
   * Mark transactions as reconciled
   */
  async markReconciled(transactionIds: string[], _reconciledBy: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET is_reconciled = true, updated_at = $1 WHERE id = ANY($2) AND is_reconciled = false',
        [new Date().toISOString(), transactionIds]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to mark transactions as reconciled', { cause: error })
    }
  }

  async updateNote(id: string, note: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET fee_discrepancy_note = $1, updated_at = $2 WHERE id = $3',
        [note, new Date().toISOString(), id]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to update note', { cause: error })
    }
  }

  /**
   * Find transactions by import source
   */
  async findBySourceId(sourceId: string): Promise<AggregatedTransaction[]> {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM aggregated_transactions WHERE source_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
        [sourceId]
      )
      return rows
    } catch (error: any) {
      throw new DatabaseError('Failed to fetch transactions by source', { cause: error })
    }
  }

  /**
   * Find unreconciled transactions for a given date range
   */
  async findUnreconciled(
    dateFrom?: string,
    dateTo?: string,
    branchName?: string
  ): Promise<AggregatedTransaction[]> {
    const conditions: string[] = ['is_reconciled = false', 'deleted_at IS NULL', 'superseded_by IS NULL']
    const params: any[] = []

    if (dateFrom) {
      params.push(dateFrom)
      conditions.push(`transaction_date >= $${params.length}::date`)
    }
    if (dateTo) {
      params.push(dateTo)
      conditions.push(`transaction_date <= $${params.length}::date`)
    }
    if (branchName) {
      params.push(branchName)
      conditions.push(`branch_name = $${params.length}`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    try {
      const { rows } = await pool.query(
        `SELECT * FROM aggregated_transactions ${where} ORDER BY transaction_date ASC`,
        params
      )
      return rows
    } catch (error: any) {
      throw new DatabaseError('Failed to fetch unreconciled transactions', { cause: error })
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(
    dateFrom?: string,
    dateTo?: string,
    branchNames?: string[],
    paymentMethodIds?: number[],
    status?: string,
    isReconciled?: boolean,
  ): Promise<{
    total_count: number
    total_gross_amount: number
    total_discount_amount: number
    total_tax_amount: number
    total_service_charge_amount: number
    total_bill_after_discount: number
    total_percentage_fee_amount: number
    total_fixed_fee_amount: number
    total_fee_amount: number
    total_nett_amount: number
    total_actual_nett_amount: number
    total_fee_discrepancy: number
  }> {
    const conditions: string[] = ['deleted_at IS NULL', 'superseded_by IS NULL']
    const params: any[] = []

    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    } else {
      conditions.push('status NOT IN (\'VOID\', \'SUPERSEDED\')')
    }

    if (isReconciled !== undefined) {
      params.push(isReconciled)
      conditions.push(`is_reconciled = $${params.length}`)
    }
    if (dateFrom) {
      params.push(dateFrom)
      conditions.push(`transaction_date >= $${params.length}::date`)
    }
    if (dateTo) {
      params.push(dateTo)
      conditions.push(`transaction_date <= $${params.length}::date`)
    }
    if (branchNames && branchNames.length > 0) {
      const orConditions = branchNames.map(b => {
        params.push(`%${b}%`)
        return `branch_name ILIKE $${params.length}`
      }).join(' OR ')
      conditions.push(`(${orConditions})`)
    }
    if (paymentMethodIds && paymentMethodIds.length > 0) {
      params.push(paymentMethodIds)
      conditions.push(`payment_method_id = ANY($${params.length})`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    try {
      const query = `
        SELECT 
          COUNT(*)::int as total_count,
          COALESCE(SUM(gross_amount), 0) as total_gross_amount,
          COALESCE(SUM(discount_amount), 0) as total_discount_amount,
          COALESCE(SUM(tax_amount), 0) as total_tax_amount,
          COALESCE(SUM(service_charge_amount), 0) as total_service_charge_amount,
          COALESCE(SUM(bill_after_discount), 0) as total_bill_after_discount,
          COALESCE(SUM(percentage_fee_amount), 0) as total_percentage_fee_amount,
          COALESCE(SUM(fixed_fee_amount), 0) as total_fixed_fee_amount,
          COALESCE(SUM(total_fee_amount), 0) as total_fee_amount,
          COALESCE(SUM(nett_amount), 0) as total_nett_amount,
          COALESCE(SUM(actual_nett_amount), 0) as total_actual_nett_amount,
          COALESCE(SUM(fee_discrepancy), 0) as total_fee_discrepancy
        FROM aggregated_transactions
        ${where}
      `
      const { rows } = await pool.query(query, params)
      const res = rows[0]
      return {
        total_count: res.total_count,
        total_gross_amount: Number(res.total_gross_amount),
        total_discount_amount: Number(res.total_discount_amount),
        total_tax_amount: Number(res.total_tax_amount),
        total_service_charge_amount: Number(res.total_service_charge_amount),
        total_bill_after_discount: Number(res.total_bill_after_discount),
        total_percentage_fee_amount: Number(res.total_percentage_fee_amount),
        total_fixed_fee_amount: Number(res.total_fixed_fee_amount),
        total_fee_amount: Number(res.total_fee_amount),
        total_nett_amount: Number(res.total_nett_amount),
        total_actual_nett_amount: Number(res.total_actual_nett_amount),
        total_fee_discrepancy: Number(res.total_fee_discrepancy)
      }
    } catch (error: any) {
      throw new DatabaseError('Failed to get summary statistics', { cause: error })
    }
  }

  /**
   * Get transaction counts by status
   */
  async getStatusCounts(
    dateFrom?: string,
    dateTo?: string,
    branchNames?: string[],
    paymentMethodIds?: number[]
  ): Promise<Record<AggregatedTransactionStatus, number>> {
    const conditions: string[] = ['deleted_at IS NULL', 'superseded_by IS NULL']
    const params: any[] = []

    if (dateFrom) {
      params.push(dateFrom)
      conditions.push(`transaction_date >= $${params.length}::date`)
    }
    if (dateTo) {
      params.push(dateTo)
      conditions.push(`transaction_date <= $${params.length}::date`)
    }
    if (branchNames && branchNames.length > 0) {
      const orConditions = branchNames.map(b => {
        params.push(`%${b}%`)
        return `branch_name ILIKE $${params.length}`
      }).join(' OR ')
      conditions.push(`(${orConditions})`)
    }
    if (paymentMethodIds && paymentMethodIds.length > 0) {
      params.push(paymentMethodIds)
      conditions.push(`payment_method_id = ANY($${params.length})`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    const counts: Record<AggregatedTransactionStatus, number> = {
      READY: 0, PENDING: 0, PROCESSING: 0, COMPLETED: 0, CANCELLED: 0, FAILED: 0, VOID: 0, SUPERSEDED: 0
    }

    try {
      const { rows } = await pool.query(
        `SELECT status, COUNT(*)::int as count FROM aggregated_transactions ${where} GROUP BY status`,
        params
      )
      rows.forEach(r => {
        if (r.status in counts) counts[r.status as AggregatedTransactionStatus] = r.count
      })
      return counts
    } catch (error: any) {
      throw new DatabaseError('Failed to get status counts', { cause: error })
    }
  }

  /**
   * Map database row to ListItem
   */
  private mapToListItem(row: Record<string, unknown>): AggregatedTransactionListItem {
    const paymentMethod = Array.isArray(row.payment_methods) ? row.payment_methods[0] : row.payment_methods

    return {
      id: row.id as string,
      branch_id: row.branch_id as string | null,
      source_type: row.source_type as AggregatedTransactionSourceType,
      source_id: row.source_id as string,
      source_ref: row.source_ref as string,
      transaction_date: row.transaction_date as string,
      payment_method_id: row.payment_method_id as number,
      gross_amount: Number(row.gross_amount),
      discount_amount: Number(row.discount_amount),
      tax_amount: Number(row.tax_amount),
      service_charge_amount: Number(row.service_charge_amount),
      bill_after_discount: Number(row.bill_after_discount || 0),
      percentage_fee_amount: Number(row.percentage_fee_amount || 0),
      fixed_fee_amount: Number(row.fixed_fee_amount || 0),
      total_fee_amount: Number(row.total_fee_amount || 0),
      nett_amount: Number(row.nett_amount),
      actual_nett_amount: Number(row.actual_nett_amount),
      actual_fee_amount: row.actual_fee_amount != null ? Number(row.actual_fee_amount) : null,
      fee_discrepancy: row.fee_discrepancy != null ? Number(row.fee_discrepancy) : null,
      fee_discrepancy_note: row.fee_discrepancy_note as string | null,
      currency: row.currency as string,
      status: row.status as AggregatedTransactionStatus,
      is_reconciled: row.is_reconciled as boolean,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: row.deleted_at as string,
      deleted_by: row.deleted_by as string,
      version: row.version as number,
      branch_name: row.branch_name as string,
      payment_method_name: (paymentMethod as Record<string, unknown>)?.name as string | undefined,
      failed_reason: (row.failed_reason as string) || null,
      failed_at: (row.failed_at as string) || null,
    }
  }

  /**
   * Map database row to WithDetails
   */
  private mapToWithDetails(
    aggData: Record<string, unknown>, 
    bankData: Record<string, unknown> | null,
    settlementAgg: Record<string, unknown> | null = null,
    multiMatchAgg: Record<string, unknown> | null = null,
    cashDepositData: Record<string, unknown> | null = null
  ): AggregatedTransactionWithDetails {
    const paymentMethod = Array.isArray(aggData.payment_methods) ? aggData.payment_methods[0] : aggData.payment_methods
    const journal = Array.isArray(aggData.journal) ? aggData.journal[0] : aggData.journal

    const bankAccount = Array.isArray(bankData?.bank_accounts) ? bankData.bank_accounts[0] : bankData?.bank_accounts
    const bank = Array.isArray(bankAccount?.banks) ? bankAccount.banks[0] : bankAccount?.banks

    const settlementGroup = settlementAgg?.bank_settlement_groups as Record<string, unknown> | null
    const settlementStmt = Array.isArray(settlementGroup?.bank_statements)
      ? settlementGroup?.bank_statements[0]
      : settlementGroup?.bank_statements as Record<string, unknown> | null

    const multiMatchDetails = Array.isArray(multiMatchAgg?.bank_reconciliation_group_details)
      ? multiMatchAgg.bank_reconciliation_group_details
      : []

    const multiMatchStatements = multiMatchDetails.map((d: any) => ({
      id: d.bank_statements?.id ?? null,
      description: d.bank_statements?.description ?? null,
      credit_amount: Number(d.bank_statements?.credit_amount || 0),
      debit_amount: Number(d.bank_statements?.debit_amount || 0),
      transaction_date: d.bank_statements?.transaction_date ?? null,
      amount: (Number(d.bank_statements?.credit_amount || 0)) - (Number(d.bank_statements?.debit_amount || 0)),
    }))

    return {
      id: aggData.id as string,
      branch_id: aggData.branch_id as string,
      branch_name: aggData.branch_name as string | null,
      source_type: aggData.source_type as AggregatedTransactionSourceType,
      source_id: aggData.source_id as string,
      source_ref: aggData.source_ref as string,
      transaction_date: aggData.transaction_date as string,
      payment_method_id: aggData.payment_method_id as number,
      gross_amount: Number(aggData.gross_amount),
      discount_amount: Number(aggData.discount_amount),
      tax_amount: Number(aggData.tax_amount),
      service_charge_amount: Number(aggData.service_charge_amount),
      bill_after_discount: Number(aggData.bill_after_discount || 0),
      percentage_fee_amount: Number(aggData.percentage_fee_amount || 0),
      fixed_fee_amount: Number(aggData.fixed_fee_amount || 0),
      total_fee_amount: Number(aggData.total_fee_amount || 0),
      nett_amount: Number(aggData.nett_amount),
      actual_nett_amount: Number(aggData.actual_nett_amount),
      rounding_amount: Number(aggData.rounding_amount ?? 0),
      delivery_cost: Number(aggData.delivery_cost ?? 0),
      order_fee: Number(aggData.order_fee ?? 0),
      voucher_discount_amount: Number(aggData.voucher_discount_amount ?? 0),
      promotion_discount_amount: Number(aggData.promotion_discount_amount ?? 0),
      menu_discount_amount: Number(aggData.menu_discount_amount ?? 0),
      voucher_payment_amount: Number(aggData.voucher_payment_amount ?? 0),
      other_vat_amount: Number(aggData.other_vat_amount ?? 0),
      pax_total: Number(aggData.pax_total ?? 0),
      actual_fee_amount: aggData.actual_fee_amount != null ? Number(aggData.actual_fee_amount) : null,
      fee_discrepancy: aggData.fee_discrepancy != null ? Number(aggData.fee_discrepancy) : null,
      fee_discrepancy_note: aggData.fee_discrepancy_note as string | null,
      currency: aggData.currency as string,
      journal_id: aggData.journal_id as string | null,
      is_reconciled: aggData.is_reconciled as boolean,
      created_at: aggData.created_at as string,
      updated_at: aggData.updated_at as string,
      deleted_at: aggData.deleted_at as string | null,
      deleted_by: aggData.deleted_by as string | null,
      version: aggData.version as number,
      status: aggData.status as AggregatedTransactionStatus,
      payment_method_code: (paymentMethod as Record<string, unknown>)?.code as string | undefined,
      payment_method_name: (paymentMethod as Record<string, unknown>)?.name as string | undefined,
      journal: journal as AggregatedTransactionWithDetails['journal'],
      failed_at: aggData.failed_at as string | null,
      failed_reason: aggData.failed_reason as string | null,
      bank_mutation_id: bankData?.id as string | null,
      bank_mutation_date: bankData?.transaction_date as string | null,
      bank_name: (bank as Record<string, unknown>)?.bank_name as string | null,
      bank_account_name: bankAccount?.account_name as string | null,
      bank_account_number: bankAccount?.account_number as string | null,
      reconciled_at: bankData?.is_reconciled ? new Date().toISOString() : null,
      reconciled_by: aggData.reconciled_by as string | null,
      settlement_group_id: settlementGroup?.id as string | null ?? null,
      settlement_number: settlementGroup?.settlement_number as string | null ?? null,
      settlement_date: settlementGroup?.settlement_date as string | null ?? null,
      settlement_status: settlementGroup?.status as string | null ?? null,
      settlement_bank_name: settlementGroup?.bank_name as string | null ?? null,
      settlement_bank_statement_id: settlementStmt?.id as string | null ?? null,
      settlement_bank_statement_description: settlementStmt?.description as string | null ?? null,
      settlement_bank_statement_amount: settlementStmt
        ? (Number(settlementStmt.credit_amount) || 0) - (Number(settlementStmt.debit_amount) || 0)
        : null,
      multi_match_group_id: multiMatchAgg?.id as string | null ?? null,
      multi_match_status: multiMatchAgg?.status as string | null ?? null,
      multi_match_difference: multiMatchAgg?.difference != null ? Number(multiMatchAgg.difference) : null,
      multi_match_total_bank_amount: multiMatchAgg?.total_bank_amount != null ? Number(multiMatchAgg.total_bank_amount) : null,
      multi_match_statements: multiMatchStatements.length > 0 ? multiMatchStatements : null,
      cash_deposit_id: cashDepositData?.cash_deposit_id as string | null ?? null,
      cash_deposit_amount: cashDepositData?.deposit_amount != null ? Number(cashDepositData.deposit_amount) : null,
      cash_deposit_date: cashDepositData?.deposit_date as string | null ?? null,
      cash_deposit_branch_name: cashDepositData?.deposit_branch_name as string | null ?? null,
      cash_deposit_status: cashDepositData?.deposit_status as string | null ?? null,
      cash_deposit_proof_url: cashDepositData?.deposit_proof_url as string | null ?? null,
      cash_deposit_bank_statement_id: cashDepositData?.bank_statement_id as string | null ?? null,
      cash_deposit_bank_statement_date: cashDepositData?.bank_statement_date as string | null ?? null,
      cash_deposit_bank_statement_description: cashDepositData?.bank_statement_description as string | null ?? null,
      cash_deposit_bank_statement_amount: cashDepositData?.bank_statement_amount != null ? Number(cashDepositData.bank_statement_amount) : null,
    }
  }

  /**
   * Find source_ids yang sudah punya aggregated transactions
   */
  async findMappedImports(posImportIds: string[]): Promise<Set<string>> {
    if (posImportIds.length === 0) return new Set();
    const result = new Set<string>();
    try {
      const { rows } = await pool.query(
        'SELECT source_id FROM aggregated_transactions WHERE source_id = ANY($1) AND status IN (\'READY\', \'PROCESSING\', \'COMPLETED\') AND deleted_at IS NULL',
        [posImportIds]
      )
      rows.forEach(d => result.add(d.source_id));
      return result;
    } catch (error: any) {
      throw new DatabaseError('Failed to find mapped imports', { cause: error });
    }
  }

  /**
   * Void semua aggregated transactions dari import tertentu
   */
  async voidByImportId(posImportId: string): Promise<number> {
    try {
      const { rowCount } = await pool.query(
        'UPDATE aggregated_transactions SET status = \'CANCELLED\', deleted_at = $1, updated_at = $1 WHERE source_id = $2 AND status IN (\'FAILED\', \'READY\') AND deleted_at IS NULL',
        [new Date().toISOString(), posImportId]
      )
      return rowCount || 0;
    } catch (error: any) {
      throw new DatabaseError('Failed to void aggregated transactions', { cause: error });
    }
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await pool.query('DELETE FROM aggregated_transactions WHERE id = $1', [id])
    } catch (error: any) {
      throw new DatabaseError('Failed to hard delete aggregated transaction', { cause: error })
    }
  }

  async findForFeeRecalculation(transactionDate: string): Promise<any[]> {
    try {
      const { rows } = await pool.query(
        'SELECT id, payment_method_id, gross_amount, bill_after_discount, is_reconciled, source_type FROM aggregated_transactions WHERE transaction_date = $1::date AND source_type = \'POS\' AND deleted_at IS NULL AND superseded_by IS NULL',
        [transactionDate]
      )
      return rows
    } catch (error: any) {
      throw new DatabaseError('Failed to fetch transactions for fee recalculation', { cause: error })
    }
  }

  async updateFee(id: string, feeData: { percentage_fee_amount: number, fixed_fee_amount: number, total_fee_amount: number, nett_amount: number }): Promise<void> {
    try {
      await pool.query(
        'UPDATE aggregated_transactions SET percentage_fee_amount = $1, fixed_fee_amount = $2, total_fee_amount = $3, nett_amount = $4, updated_at = $5 WHERE id = $6',
        [feeData.percentage_fee_amount, feeData.fixed_fee_amount, feeData.total_fee_amount, feeData.nett_amount, new Date().toISOString(), id]
      )
    } catch (error: any) {
      throw new DatabaseError('Failed to update fee for transaction', { cause: error })
    }
  }
}

export const posAggregatesRepository = new PosAggregatesRepository()
