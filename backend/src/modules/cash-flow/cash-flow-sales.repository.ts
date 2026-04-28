import { pool } from '../../config/db'
import { logError } from '../../config/logger'
import { DatabaseError } from '../../utils/error-handler.util'
import type {
  PaymentMethodGroup,
  CreateGroupDto,
  UpdateGroupDto,
  AvailablePaymentMethod,
  SalesBreakdownItem,
  SalesGroup,
  GetCashFlowParams,
  AccountPeriodBalance,
  CreatePeriodBalanceDto,
  UpdatePeriodBalanceDto,
  OpeningBalanceSuggestion,
} from './cash-flow-sales.types'

export class CashFlowSalesRepository {

  // ============================================================
  // Shared: Bank Account Info
  // ============================================================

  async getBankAccountInfo(bankAccountId: number, companyId: string): Promise<{
    id: number; bank_name: string; account_number: string; account_name: string
  } | null> {
    const query = `
      SELECT ba.id, ba.account_number, ba.account_name, b.bank_name
      FROM bank_accounts ba
      INNER JOIN banks b ON ba.bank_id = b.id
      WHERE ba.id = $1 
        AND ba.owner_id = $2 
        AND ba.owner_type = 'company'
        AND ba.deleted_at IS NULL
    `
    const { rows } = await pool.query(query, [bankAccountId, companyId])
    return rows[0] || null
  }

  // ============================================================
  // Period Balance CRUD
  // ============================================================

  async createPeriodBalance(dto: CreatePeriodBalanceDto): Promise<AccountPeriodBalance> {
    try {
      const keys = [
        'company_id', 'bank_account_id', 'period_start', 'period_end',
        'opening_balance', 'source', 'previous_period_id', 'notes', 'created_by'
      ]
      const values = [
        dto.company_id, dto.bank_account_id, dto.period_start, dto.period_end,
        dto.opening_balance, dto.source || 'MANUAL', dto.previous_period_id || null,
        dto.notes || null, dto.created_by || null
      ]
      const cols = keys.join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

      const { rows } = await pool.query(
        `INSERT INTO account_period_balances (${cols}) VALUES (${placeholders}) RETURNING *`,
        values
      )
      return rows[0] as AccountPeriodBalance
    } catch (error: any) {
      throw new DatabaseError('Failed to create period balance', { cause: error })
    }
  }

  async updatePeriodBalance(id: string, companyId: string, dto: UpdatePeriodBalanceDto): Promise<AccountPeriodBalance> {
    try {
      const updateFields: string[] = []
      const values: any[] = []

      if (dto.period_start !== undefined) { values.push(dto.period_start); updateFields.push(`period_start = $${values.length}`) }
      if (dto.period_end !== undefined) { values.push(dto.period_end); updateFields.push(`period_end = $${values.length}`) }
      if (dto.opening_balance !== undefined) { values.push(dto.opening_balance); updateFields.push(`opening_balance = $${values.length}`) }
      if (dto.source !== undefined) { values.push(dto.source); updateFields.push(`source = $${values.length}`) }
      if (dto.notes !== undefined) { values.push(dto.notes); updateFields.push(`notes = $${values.length}`) }
      
      values.push(dto.updated_by || null)
      updateFields.push(`updated_by = $${values.length}`)
      
      values.push(id, companyId)
      const query = `
        UPDATE account_period_balances 
        SET ${updateFields.join(', ')} 
        WHERE id = $${values.length - 1} AND company_id = $${values.length} 
        RETURNING *
      `
      const { rows } = await pool.query(query, values)
      if (rows.length === 0) throw new DatabaseError('Failed to update period balance: Not found')
      return rows[0] as AccountPeriodBalance
    } catch (error: any) {
      if (error instanceof DatabaseError) throw error
      throw new DatabaseError('Failed to update period balance', { cause: error })
    }
  }

  async deletePeriodBalance(id: string, companyId: string): Promise<void> {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM account_period_balances WHERE id = $1 AND company_id = $2',
        [id, companyId]
      )
      if (rowCount === 0) throw new DatabaseError('Failed to delete period balance: Not found')
    } catch (error: any) {
      if (error instanceof DatabaseError) throw error
      throw new DatabaseError('Failed to delete period balance', { cause: error })
    }
  }

  async findPeriodBalanceById(id: string, companyId: string): Promise<AccountPeriodBalance | null> {
    const { rows } = await pool.query(
      'SELECT * FROM account_period_balances WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )
    return (rows[0] as AccountPeriodBalance) || null
  }

  async listPeriodBalances(bankAccountId: number, companyId: string, page = 1, limit = 20): Promise<{ data: AccountPeriodBalance[]; total: number }> {
    const offset = (page - 1) * limit
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        'SELECT * FROM account_period_balances WHERE bank_account_id = $1 AND company_id = $2 ORDER BY period_start DESC LIMIT $3 OFFSET $4',
        [bankAccountId, companyId, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS total FROM account_period_balances WHERE bank_account_id = $1 AND company_id = $2',
        [bankAccountId, companyId]
      )
    ])
    return {
      data: dataRes.rows as AccountPeriodBalance[],
      total: countRes.rows[0].total
    }
  }

  async getActivePeriodBalance(bankAccountId: number, companyId: string, onOrBeforeDate: string): Promise<AccountPeriodBalance | null> {
    const { rows } = await pool.query(
      'SELECT * FROM account_period_balances WHERE bank_account_id = $1 AND company_id = $2 AND period_start <= $3 ORDER BY period_start DESC LIMIT 1',
      [bankAccountId, companyId, onOrBeforeDate]
    )
    return (rows[0] as AccountPeriodBalance) || null
  }

  async suggestOpeningBalance(bankAccountId: number, companyId: string, periodStart: string): Promise<OpeningBalanceSuggestion> {
    const prevPeriodQuery = `
      SELECT * FROM account_period_balances 
      WHERE bank_account_id = $1 AND company_id = $2 AND period_start < $3 
      ORDER BY period_start DESC LIMIT 1
    `
    const { rows: prevRows } = await pool.query(prevPeriodQuery, [bankAccountId, companyId, periodStart])
    const prevPeriod = prevRows[0] as AccountPeriodBalance | undefined

    if (!prevPeriod) {
      return { suggested_balance: null, source: 'NO_DATA', prev_period_id: null, prev_period_start: null, prev_period_end: null }
    }

    const txQuery = `
      SELECT COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0) as net
      FROM bank_statements
      WHERE bank_account_id = $1 AND company_id = $2 
        AND transaction_date >= $3 AND transaction_date <= $4
        AND deleted_at IS NULL
    `
    const { rows: txRows } = await pool.query(txQuery, [bankAccountId, companyId, prevPeriod.period_start, prevPeriod.period_end])
    const net = Number(txRows[0].net || 0)

    return {
      suggested_balance: Number(prevPeriod.opening_balance) + net,
      source: 'PREV_PERIOD',
      prev_period_id: prevPeriod.id,
      prev_period_start: prevPeriod.period_start,
      prev_period_end: prevPeriod.period_end,
    }
  }

  // ============================================================
  // Payment Method Groups CRUD
  // ============================================================

  async createGroup(dto: CreateGroupDto): Promise<PaymentMethodGroup> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      const insertGroupQuery = `
        INSERT INTO payment_method_groups (company_id, name, description, color, icon, display_order, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `
      const { rows } = await client.query(insertGroupQuery, [
        dto.company_id, dto.name, dto.description || null, dto.color || '#6366f1',
        dto.icon || null, dto.display_order ?? 0, dto.created_by || null
      ])
      const groupId = rows[0].id

      if (dto.payment_method_ids && dto.payment_method_ids.length > 0) {
        const mappingValues: any[] = []
        const mappingPlaceholders = dto.payment_method_ids.map((pmId, i) => {
          const base = i * 4
          mappingValues.push(groupId, dto.company_id, pmId, dto.created_by || null)
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        }).join(', ')

        await client.query(
          `INSERT INTO payment_method_group_mappings (group_id, company_id, payment_method_id, created_by) VALUES ${mappingPlaceholders}`,
          mappingValues
        )
      }

      await client.query('COMMIT')
      return (await this.findGroupById(groupId, dto.company_id)) as PaymentMethodGroup
    } catch (error: any) {
      await client.query('ROLLBACK')
      if (error.code === '23505') {
        throw new Error(`Group "${dto.name}" already exists for this company`)
      }
      logError('CashFlowSalesRepository.createGroup error', { error })
      throw error
    } finally {
      client.release()
    }
  }

  async updateGroup(id: string, companyId: string, dto: UpdateGroupDto): Promise<PaymentMethodGroup> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const updateFields: string[] = []
      const values: any[] = []

      if (dto.name !== undefined) { values.push(dto.name); updateFields.push(`name = $${values.length}`) }
      if (dto.description !== undefined) { values.push(dto.description); updateFields.push(`description = $${values.length}`) }
      if (dto.color !== undefined) { values.push(dto.color); updateFields.push(`color = $${values.length}`) }
      if (dto.icon !== undefined) { values.push(dto.icon); updateFields.push(`icon = $${values.length}`) }
      if (dto.display_order !== undefined) { values.push(dto.display_order); updateFields.push(`display_order = $${values.length}`) }
      if (dto.is_active !== undefined) { values.push(dto.is_active); updateFields.push(`is_active = $${values.length}`) }

      values.push(dto.updated_by || null)
      updateFields.push(`updated_by = $${values.length}`)

      if (updateFields.length > 1) { // more than just updated_by
        values.push(id, companyId)
        await client.query(
          `UPDATE payment_method_groups SET ${updateFields.join(', ')} WHERE id = $${values.length - 1} AND company_id = $${values.length}`,
          values
        )
      }

      if (dto.payment_method_ids !== undefined) {
        await client.query('DELETE FROM payment_method_group_mappings WHERE group_id = $1', [id])
        if (dto.payment_method_ids.length > 0) {
          const mappingValues: any[] = []
          const mappingPlaceholders = dto.payment_method_ids.map((pmId, i) => {
            const base = i * 4
            mappingValues.push(id, companyId, pmId, dto.updated_by || null)
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
          }).join(', ')

          await client.query(
            `INSERT INTO payment_method_group_mappings (group_id, company_id, payment_method_id, created_by) VALUES ${mappingPlaceholders}`,
            mappingValues
          )
        }
      }

      await client.query('COMMIT')
      return (await this.findGroupById(id, companyId)) as PaymentMethodGroup
    } catch (error) {
      await client.query('ROLLBACK')
      logError('CashFlowSalesRepository.updateGroup error', { id, error })
      throw error
    } finally {
      client.release()
    }
  }

  async deleteGroup(id: string, companyId: string): Promise<void> {
    try {
      await pool.query('DELETE FROM payment_method_groups WHERE id = $1 AND company_id = $2', [id, companyId])
    } catch (error) {
      logError('CashFlowSalesRepository.deleteGroup error', { id, error })
      throw error
    }
  }

  async findGroupById(id: string, companyId: string): Promise<PaymentMethodGroup | null> {
    const query = `
      SELECT pmg.*, 
        COALESCE(
          json_agg(pmgm.*) FILTER (WHERE pmgm.id IS NOT NULL), 
          '[]'
        ) as mappings
      FROM payment_method_groups pmg
      LEFT JOIN payment_method_group_mappings pmgm ON pmg.id = pmgm.group_id
      WHERE pmg.id = $1 AND pmg.company_id = $2
      GROUP BY pmg.id
    `
    const { rows } = await pool.query(query, [id, companyId])
    return rows[0] || null
  }

  async listGroups(companyId: string): Promise<PaymentMethodGroup[]> {
    const query = `
      SELECT pmg.*, 
        COALESCE(
          json_agg(pmgm.*) FILTER (WHERE pmgm.id IS NOT NULL), 
          '[]'
        ) as mappings
      FROM payment_method_groups pmg
      LEFT JOIN payment_method_group_mappings pmgm ON pmg.id = pmgm.group_id
      WHERE pmg.company_id = $1
      GROUP BY pmg.id
      ORDER BY pmg.display_order ASC, pmg.created_at ASC
    `
    const { rows } = await pool.query(query, [companyId])
    return rows as PaymentMethodGroup[]
  }

  async replaceGroupMappings(
    groupId: string,
    companyId: string,
    paymentMethodIds: number[],
    userId?: string | null
  ): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM payment_method_group_mappings WHERE group_id = $1', [groupId])

      if (paymentMethodIds.length > 0) {
        const mappingValues: any[] = []
        const mappingPlaceholders = paymentMethodIds.map((pmId, i) => {
          const base = i * 4
          mappingValues.push(groupId, companyId, pmId, userId || null)
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
        }).join(', ')

        await client.query(
          `INSERT INTO payment_method_group_mappings (group_id, company_id, payment_method_id, created_by) VALUES ${mappingPlaceholders}`,
          mappingValues
        )
      }
      await client.query('COMMIT')
    } catch (error: any) {
      await client.query('ROLLBACK')
      if (error.code === '23505') {
        throw new Error('One or more payment methods are already assigned to another group.')
      }
      logError('CashFlowSalesRepository.replaceGroupMappings error', { groupId, error })
      throw error
    } finally {
      client.release()
    }
  }

  async reorderGroups(companyId: string, orderedIds: string[]): Promise<void> {
    if (orderedIds.length === 0) return

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const now = new Date().toISOString()
      
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i]
        const { rowCount } = await client.query(
          `UPDATE payment_method_groups SET display_order = $1, updated_at = $2 WHERE id = $3 AND company_id = $4`,
          [i, now, id, companyId]
        )
        if (rowCount === 0) {
           throw new Error(`Group ${id} not found or not in company`)
        }
      }
      
      await client.query('COMMIT')
    } catch (error: any) {
      await client.query('ROLLBACK')
      logError('CashFlowSalesRepository.reorderGroups failed', { error: error.message })
      throw new DatabaseError(`Reorder failed: ${error.message}`, { cause: error })
    } finally {
      client.release()
    }
  }

  // ============================================================
  // Available Payment Types for Mapping UI
  // ============================================================

  async getAvailablePaymentMethods(companyId: string): Promise<AvailablePaymentMethod[]> {
    try {
      const query = `
        SELECT 
          pm.id, pm.name, pm.payment_type,
          pmg.id as current_group_id,
          pmg.name as current_group_name
        FROM payment_methods pm
        LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
        LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id
        WHERE pm.company_id = $1 
          AND pm.is_active = true 
          AND pm.deleted_at IS NULL
        ORDER BY pm.name
      `
      const { rows } = await pool.query(query, [companyId])
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        payment_type: r.payment_type,
        current_group_id: r.current_group_id,
        current_group_name: r.current_group_name
      }))
    } catch (error) {
      logError('CashFlowSalesRepository.getAvailablePaymentMethods error', { error })
      throw error
    }
  }

  // ============================================================
  // Cash Flow Sales Data
  // ============================================================

  async getSalesBreakdown(
    params: GetCashFlowParams
  ): Promise<{
    groups: SalesGroup[]
    total_income: number
    unreconciled_count: number
    unreconciled_credit_count: number
    unreconciled_credit_amount: number
    unreconciled_debit_count: number
    unreconciled_debit_amount: number
  }> {
    try {
      // 1. Get bank statements status counts in one go
      const statusQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE NOT is_reconciled AND NOT is_pending) as unrecon_count,
          COUNT(*) FILTER (WHERE NOT is_reconciled AND NOT is_pending AND credit_amount > 0) as unrecon_credit_count,
          COALESCE(SUM(credit_amount) FILTER (WHERE NOT is_reconciled AND NOT is_pending AND credit_amount > 0), 0) as unrecon_credit_amount,
          COUNT(*) FILTER (WHERE NOT is_reconciled AND NOT is_pending AND debit_amount > 0) as unrecon_debit_count,
          COALESCE(SUM(debit_amount) FILTER (WHERE NOT is_reconciled AND NOT is_pending AND debit_amount > 0), 0) as unrecon_debit_amount
        FROM bank_statements
        WHERE bank_account_id = $1 
          AND transaction_date >= $2 
          AND transaction_date <= $3
          AND deleted_at IS NULL
      `
      const { rows: [statusRow] } = await pool.query(statusQuery, [params.bank_account_id, params.date_from, params.date_to])

      // 2. Fetch all aggregates involved in reconciliation for this period
      // This is a complex query that replaces multiple roundtrips in the original code
      const aggregatesQuery = `
        WITH reconciliation_aggregates AS (
          -- Direct reconciliation
          SELECT reconciliation_id as agg_id
          FROM bank_statements
          WHERE bank_account_id = $1 
            AND transaction_date >= $2 
            AND transaction_date <= $3
            AND is_reconciled = true
            AND reconciliation_id IS NOT NULL
            AND deleted_at IS NULL
          
          UNION
          
          -- Multi-match reconciliation groups
          SELECT brg.aggregate_id
          FROM bank_statements bs
          JOIN bank_reconciliation_groups brg ON bs.reconciliation_group_id = brg.id
          WHERE bs.bank_account_id = $1 
            AND bs.transaction_date >= $2 
            AND bs.transaction_date <= $3
            AND bs.is_reconciled = true
            AND bs.reconciliation_id IS NULL
            AND bs.reconciliation_group_id IS NOT NULL
            AND bs.deleted_at IS NULL
            
          UNION
          
          -- Settlement groups
          SELECT bsa.aggregate_id
          FROM bank_statements bs
          JOIN bank_settlement_groups bsg ON bs.id = bsg.bank_statement_id
          JOIN bank_settlement_aggregates bsa ON bsg.id = bsa.group_id
          WHERE bs.bank_account_id = $1 
            AND bs.transaction_date >= $2 
            AND bs.transaction_date <= $3
            AND bs.is_reconciled = true
            AND bs.reconciliation_id IS NULL
            AND bs.reconciliation_group_id IS NULL
            AND bs.cash_deposit_id IS NULL
            AND bs.deleted_at IS NULL
            AND bsg.deleted_at IS NULL
        )
        SELECT 
          at.id, at.branch_id, at.branch_name, at.payment_method_id, 
          at.actual_nett_amount, at.nett_amount,
          pm.name as payment_method_name, pm.payment_type,
          pmg.id as group_id, pmg.name as group_name, pmg.color as group_color, pmg.display_order as group_display_order
        FROM aggregated_transactions at
        JOIN reconciliation_aggregates ra ON at.id = ra.agg_id
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
        LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id AND pmg.company_id = $4
        WHERE at.deleted_at IS NULL
          ${params.branch_id ? 'AND at.branch_id = $5' : ''}
      `
      const aggParams = [params.bank_account_id, params.date_from, params.date_to, params.company_id]
      if (params.branch_id) aggParams.push(params.branch_id)
      
      const { rows: aggs } = await pool.query(aggregatesQuery, aggParams)

      // 3. Process aggregates into groups (same logic as original but with data from joined query)
      const groupMap = new Map<string, any>()

      for (const row of aggs) {
        const groupKey = row.group_id || 'UNGROUPED'
        const amount = Number(row.actual_nett_amount ?? row.nett_amount ?? 0)
        const methodName = row.payment_method_name || 'Lainnya'

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            group_id: row.group_id || null,
            group_name: row.group_name || 'Lainnya',
            group_color: row.group_color || '#9ca3af',
            display_order: row.group_display_order ?? 999,
            items: new Map(),
          })
        }

        const group = groupMap.get(groupKey)!
        if (!group.items.has(methodName)) {
          group.items.set(methodName, { payment_type: row.payment_type || 'OTHER', total: 0, count: 0, branches: new Map() })
        }
        const item = group.items.get(methodName)!
        item.total += amount
        item.count++

        const branchKey = row.branch_id || 'unknown'
        if (!item.branches.has(branchKey)) {
          item.branches.set(branchKey, { name: row.branch_name || branchKey, total: 0, count: 0 })
        }
        const branch = item.branches.get(branchKey)!
        branch.total += amount
        branch.count++
      }

      const groups: SalesGroup[] = [...groupMap.values()]
        .sort((a, b) => a.display_order - b.display_order)
        .map(g => {
          const items: SalesBreakdownItem[] = [...g.items.entries()]
            .map(([name, data]) => ({
              payment_method_name: name,
              payment_type: data.payment_type,
              total_amount: data.total,
              transaction_count: data.count,
              branch_breakdown: [...data.branches.entries()].map(([bid, b]) => ({
                branch_id: bid, branch_name: b.name, total_amount: b.total, transaction_count: b.count,
              })).sort((a, b) => b.total_amount - a.total_amount),
            }))
            .sort((a, b) => b.total_amount - a.total_amount)

          return {
            group_id: g.group_id, group_name: g.group_name, group_color: g.group_color, display_order: g.display_order,
            items,
            subtotal: items.reduce((s, i) => s + i.total_amount, 0),
            transaction_count: items.reduce((s, i) => s + i.transaction_count, 0),
          }
        })

      return {
        groups,
        total_income: groups.reduce((s, g) => s + g.subtotal, 0),
        unreconciled_count: Number(statusRow.unrecon_count),
        unreconciled_credit_count: Number(statusRow.unrecon_credit_count),
        unreconciled_credit_amount: Number(statusRow.unrecon_credit_amount),
        unreconciled_debit_count: Number(statusRow.unrecon_debit_count),
        unreconciled_debit_amount: Number(statusRow.unrecon_debit_amount),
      }
    } catch (error) {
      logError('CashFlowSalesRepository.getSalesBreakdown error', { params, error })
      throw error
    }
  }

  async getRunningBalanceWithSales(
    params: GetCashFlowParams,
    page: number = 1,
    limit: number = 100
  ): Promise<{ rows: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit

      const [dataRes, countRes] = await Promise.all([
        pool.query(`
          SELECT 
            id, bank_account_id, company_id, import_id,
            transaction_date, row_number, description,
            credit_amount, debit_amount, balance,
            is_pending, is_reconciled, reference_number, transaction_type,
            reconciliation_id, reconciliation_group_id, cash_deposit_id,
            created_at
          FROM bank_statements
          WHERE bank_account_id = $1 AND company_id = $2
            AND transaction_date >= $3 AND transaction_date <= $4
            AND deleted_at IS NULL
          ORDER BY transaction_date ASC, row_number ASC
          LIMIT $5 OFFSET $6
        `, [params.bank_account_id, params.company_id, params.date_from, params.date_to, limit, offset]),
        pool.query(`
          SELECT COUNT(*)::int as total
          FROM bank_statements
          WHERE bank_account_id = $1 AND company_id = $2
            AND transaction_date >= $3 AND transaction_date <= $4
            AND deleted_at IS NULL
        `, [params.bank_account_id, params.company_id, params.date_from, params.date_to])
      ])

      const rows = dataRes.rows
      if (rows.length === 0) return { rows: [], total: countRes.rows[0].total }

      // Enrich info logic - optimized with joined query for all rows in batch
      const statementIds = rows.map(r => r.id)
      
      const enrichmentQuery = `
        WITH enriched_info AS (
          -- Direct reconciliation
          SELECT bs.id as statement_id, at.branch_name, pm.name as pm_name, pm.payment_type, pmg.name as g_name, pmg.color as g_color
          FROM bank_statements bs
          JOIN aggregated_transactions at ON bs.reconciliation_id = at.id
          LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
          LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
          LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id AND pmg.company_id = $2
          WHERE bs.id = ANY($1) AND bs.reconciliation_id IS NOT NULL
          
          UNION ALL
          
          -- Group reconciliation
          SELECT bs.id as statement_id, at.branch_name, pm.name as pm_name, pm.payment_type, pmg.name as g_name, pmg.color as g_color
          FROM bank_statements bs
          JOIN bank_reconciliation_groups brg ON bs.reconciliation_group_id = brg.id
          JOIN aggregated_transactions at ON brg.aggregate_id = at.id
          LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
          LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
          LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id AND pmg.company_id = $2
          WHERE bs.id = ANY($1) AND bs.reconciliation_id IS NULL AND bs.reconciliation_group_id IS NOT NULL
          
          UNION ALL
          
          -- Cash deposits
          SELECT bs.id as statement_id, cd.branch_name, pm.name as pm_name, 'CASH' as payment_type, pmg.name as g_name, pmg.color as g_color
          FROM bank_statements bs
          JOIN cash_deposits cd ON bs.cash_deposit_id = cd.id
          LEFT JOIN payment_methods pm ON cd.payment_method_id = pm.id
          LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
          LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id AND pmg.company_id = $2
          WHERE bs.id = ANY($1) AND bs.cash_deposit_id IS NOT NULL
          
          UNION ALL
          
          -- Settlements
          SELECT bs.id as statement_id, at.branch_name, pm.name as pm_name, pm.payment_type, pmg.name as g_name, pmg.color as g_color
          FROM bank_statements bs
          JOIN bank_settlement_groups bsg ON bs.id = bsg.bank_statement_id
          JOIN bank_settlement_aggregates bsa ON bsg.id = bsa.group_id
          JOIN aggregated_transactions at ON bsa.aggregate_id = at.id
          LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
          LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
          LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id AND pmg.company_id = $2
          WHERE bs.id = ANY($1) 
            AND bs.is_reconciled = true 
            AND bs.reconciliation_id IS NULL 
            AND bs.reconciliation_group_id IS NULL 
            AND bs.cash_deposit_id IS NULL
        )
        -- Keep only one entry per statement_id (in case of multiple aggregates in settlement, though display logic only needs one)
        SELECT DISTINCT ON (statement_id) * FROM enriched_info ORDER BY statement_id
      `
      const { rows: enrichments } = await pool.query(enrichmentQuery, [statementIds, params.company_id])
      const enrichmentMap = new Map(enrichments.map(e => [e.statement_id, e]))

      const enriched = rows.map((row) => {
        const info = enrichmentMap.get(row.id) as any

        return {
          ...row,
          display_description: info
            ? `${info.pm_name || (row.cash_deposit_id ? 'Setoran Tunai' : 'Lainnya')}${info.branch_name ? ` - ${info.branch_name}` : ''}`
            : row.description,
          payment_method_name: info?.pm_name || (row.cash_deposit_id ? 'Setoran Tunai' : null),
          payment_type: info?.payment_type || (row.cash_deposit_id ? 'CASH' : null),
          group_name: info?.g_name || null,
          group_color: info?.g_color || null,
          branch_name: info?.branch_name || null,
          expense_category: null,
        }
      })

      return { rows: enriched, total: countRes.rows[0].total }
    } catch (error) {
      logError('CashFlowSalesRepository.getRunningBalanceWithSales error', { params, error })
      throw error
    }
  }

  async getBranches(companyId: string): Promise<Array<{ branch_id: string; branch_name: string }>> {
    const { rows } = await pool.query(
      'SELECT id, branch_name FROM branches WHERE company_id = $1 AND status = \'active\' ORDER BY branch_name',
      [companyId]
    )
    return rows.map(b => ({ branch_id: b.id, branch_name: b.branch_name }))
  }

  async getCumulativeNetBeforeOffset(
    bankAccountId: number, companyId: string,
    fromDate: string, beforeDate: string, beforeRowNumber: number
  ): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0) as net
      FROM bank_statements
      WHERE bank_account_id = $1 AND company_id = $2
        AND (
          (transaction_date >= $3 AND transaction_date < $4)
          OR (transaction_date = $4 AND row_number < $5)
        )
        AND deleted_at IS NULL
    `
    const { rows } = await pool.query(query, [bankAccountId, companyId, fromDate, beforeDate, beforeRowNumber])
    return Number(rows[0].net || 0)
  }

  async getCumulativeNetUpToDate(
    bankAccountId: number, companyId: string,
    fromDate: string, toDate: string
  ): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(credit_amount), 0) - COALESCE(SUM(debit_amount), 0) as net
      FROM bank_statements
      WHERE bank_account_id = $1 AND company_id = $2
        AND transaction_date >= $3 AND transaction_date <= $4
        AND deleted_at IS NULL
    `
    const { rows } = await pool.query(query, [bankAccountId, companyId, fromDate, toDate])
    return Number(rows[0].net || 0)
  }

  async getPendingCount(
    bankAccountId: number, companyId: string,
    dateFrom: string, dateTo: string
  ): Promise<{ count: number; estimated_credit: number; estimated_debit: number }> {
    const query = `
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(credit_amount), 0) as estimated_credit,
        COALESCE(SUM(debit_amount), 0) as estimated_debit
      FROM bank_statements
      WHERE bank_account_id = $1 AND company_id = $2
        AND transaction_date >= $3 AND transaction_date <= $4
        AND is_pending = true AND deleted_at IS NULL
    `
    const { rows } = await pool.query(query, [bankAccountId, companyId, dateFrom, dateTo])
    return {
      count: rows[0].count,
      estimated_credit: Number(rows[0].estimated_credit),
      estimated_debit: Number(rows[0].estimated_debit)
    }
  }

  // ============================================================
  // Cash Deposits (setoran tunai yang sudah masuk bank)
  // ============================================================

  async getCashDepositBreakdown(
    bankAccountId: number,
    companyId: string,
    dateFrom: string,
    dateTo: string,
    branchId?: string
  ): Promise<Array<{
    deposit_id: string
    deposit_amount: number
    deposit_date: string
    branch_name: string | null
    branch_id: string | null
    payment_method_id: number | null
    payment_method_name: string | null
    group_id: string | null
    group_name: string | null
    group_color: string | null
    group_display_order: number | null
  }>> {
    try {
      const query = `
        SELECT 
          cd.id as deposit_id,
          cd.deposit_amount,
          cd.deposit_date,
          cd.branch_name,
          b.id as branch_id,
          cd.payment_method_id,
          pm.name as payment_method_name,
          pmg.id as group_id,
          pmg.name as group_name,
          pmg.color as group_color,
          pmg.display_order as group_display_order
        FROM bank_statements bs
        JOIN cash_deposits cd ON bs.cash_deposit_id = cd.id
        LEFT JOIN branches b ON cd.branch_name = b.branch_name AND b.company_id = $1 AND b.status = 'active'
        LEFT JOIN payment_methods pm ON cd.payment_method_id = pm.id
        LEFT JOIN payment_method_group_mappings pmgm ON pm.id = pmgm.payment_method_id
        LEFT JOIN payment_method_groups pmg ON pmgm.group_id = pmg.id AND pmg.company_id = $1
        WHERE bs.bank_account_id = $2
          AND bs.company_id = $1
          AND bs.transaction_date >= $3
          AND bs.transaction_date <= $4
          AND bs.cash_deposit_id IS NOT NULL
          AND bs.deleted_at IS NULL
          ${branchId ? 'AND b.id = $5' : ''}
      `
      const params: any[] = [companyId, bankAccountId, dateFrom, dateTo]
      if (branchId) params.push(branchId)

      const { rows } = await pool.query(query, params)
      return rows.map(r => ({
        deposit_id: r.deposit_id,
        deposit_amount: Number(r.deposit_amount) || 0,
        deposit_date: r.deposit_date,
        branch_name: r.branch_name,
        branch_id: r.branch_id,
        payment_method_id: r.payment_method_id,
        payment_method_name: r.payment_method_name || 'Setoran Tunai',
        group_id: r.group_id,
        group_name: r.group_name,
        group_color: r.group_color,
        group_display_order: r.group_display_order
      }))
    } catch (error) {
      logError('CashFlowSalesRepository.getCashDepositBreakdown error', { error })
      return []
    }
  }
}

export const cashFlowSalesRepository = new CashFlowSalesRepository()
