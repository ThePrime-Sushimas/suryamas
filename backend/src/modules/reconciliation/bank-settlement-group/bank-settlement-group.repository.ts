/**
 * Settlement Group Repository
 * Handles all database operations for bank_settlement_groups and bank_settlement_aggregates tables
 */

import { pool } from "../../../config/db";
import { logError, logInfo } from "../../../config/logger";
import { SettlementGroupStatus } from "./bank-settlement-group.types";

/**
 * Safely convert bank_statement_id to string
 */
const safeBankStatementIdToString = (id: any): string | null => {
  if (id === null || id === undefined) return null;
  if (typeof id === 'string') {
    if (id.trim() === '' || id.toLowerCase() === 'null' || id.toLowerCase() === 'undefined') return null;
  }
  const num = Number(id);
  if (isNaN(num) || num <= 0) return null;
  return String(num);
};

export class SettlementGroupRepository {
  constructor() {}

  /**
   * Execute operations within a database transaction
   */
  async withTransaction<T>(operation: (client: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Transaction failed, rolled back", { error: errorMessage });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new settlement group
   */
  async createSettlementGroup(data: {
    companyId: string;
    bankStatementId?: string;
    settlementDate: string;
    paymentMethod?: string;
    bankName?: string;
    totalStatementAmount: number;
    totalAllocatedAmount: number;
    difference: number;
    notes?: string;
    createdBy?: string;
    status?: SettlementGroupStatus;
  }): Promise<string> {
    try {
      const bankStatementIdNum = data.bankStatementId ? Number(data.bankStatementId) : null;
      
      const query = `
        INSERT INTO bank_settlement_groups (
          company_id, bank_statement_id, settlement_date, payment_method, 
          bank_name, total_statement_amount, total_allocated_amount, 
          difference, notes, created_by, status, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      const values = [
        data.companyId, bankStatementIdNum, data.settlementDate, data.paymentMethod || null,
        data.bankName || null, data.totalStatementAmount, data.totalAllocatedAmount,
        data.difference, data.notes || null, data.createdBy || null,
        data.status || SettlementGroupStatus.PENDING, new Date().toISOString()
      ];

      const { rows } = await pool.query(query, values);
      return rows[0].id;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error creating settlement group", {
        companyId: data.companyId,
        bankStatementId: data.bankStatementId,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Get settlement group by ID with aggregates, statements, and bank statement info
   */
  async findById(id: string): Promise<any> {
    try {
      const query = `
        SELECT 
          bsg.*
        FROM bank_settlement_groups bsg
        WHERE bsg.id = $1 AND bsg.deleted_at IS NULL
      `;
      
      const { rows } = await pool.query(query, [id]);
      if (rows.length === 0) return null;

      const data = rows[0];
      const aggregates = await this.getAggregatesByGroupId(id);
      const statements = await this.getStatementsByGroupId(id);
      return this.transformSettlementGroup(data, aggregates, statements);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group by ID", { id, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get bank statements for a settlement group from junction table
   */
  async getStatementsByGroupId(settlementGroupId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          bs.id, bs.transaction_date, bs.description,
          bs.debit_amount, bs.credit_amount,
          (bs.credit_amount - bs.debit_amount) as amount,
          b.bank_name, ba.account_name, ba.account_number
        FROM bank_settlement_statements bss
        JOIN bank_statements bs ON bss.bank_statement_id = bs.id
        LEFT JOIN bank_accounts ba ON bs.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        WHERE bss.settlement_group_id = $1
        ORDER BY bs.transaction_date ASC
      `;
      const { rows } = await pool.query(query, [settlementGroupId]);
      return rows.map((r: any) => ({ ...r, id: String(r.id) }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching statements by group ID", { settlementGroupId, error: errorMessage });
      return [];
    }
  }

  /**
   * Get settlement group by ID INCLUDING soft-deleted records
   */
  async findByIdIncludingDeleted(id: string): Promise<any> {
    try {
      const { rows } = await pool.query("SELECT * FROM bank_settlement_groups WHERE id = $1", [id]);
      return rows[0] || null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group by ID (including deleted)", { id, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get settlement group by settlement number
   */
  async findBySettlementNumber(settlementNumber: string): Promise<any> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM bank_settlement_groups WHERE settlement_number = $1 AND deleted_at IS NULL", 
        [settlementNumber]
      );
      return rows[0] || null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group by number", { settlementNumber, error: errorMessage });
      throw error;
    }
  }

  /**
   * Add bank statements to settlement group junction table
   */
  async addStatementsToGroup(settlementGroupId: string, statementIds: string[]): Promise<void> {
    try {
      if (statementIds.length === 0) return;
      const values: any[] = [];
      const placeholders = statementIds.map((id, i) => {
        const base = i * 2;
        values.push(settlementGroupId, Number(id));
        return `($${base + 1}, $${base + 2})`;
      }).join(", ");

      await pool.query(
        `INSERT INTO bank_settlement_statements (settlement_group_id, bank_statement_id) VALUES ${placeholders}`,
        values
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error adding statements to settlement group", {
        settlementGroupId,
        count: statementIds.length,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Get statement IDs from junction table for a settlement group
   */
  async getStatementIdsByGroupId(settlementGroupId: string): Promise<string[]> {
    try {
      const { rows } = await pool.query(
        "SELECT bank_statement_id FROM bank_settlement_statements WHERE settlement_group_id = $1",
        [settlementGroupId]
      );
      return rows.map((r: any) => String(r.bank_statement_id));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching statement IDs by group", { settlementGroupId, error: errorMessage });
      return [];
    }
  }

  /**
   * Mark multiple bank statements as reconciled
   */
  async markBankStatementsAsReconciled(statementIds: string[], userId?: string): Promise<void> {
    try {
      const numericIds = statementIds.map(Number);
      const params: any[] = [true, false, new Date().toISOString(), numericIds];
      let query = "UPDATE bank_statements SET is_reconciled = $1, is_pending = $2, updated_at = $3";
      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      query += ` WHERE id = ANY($4)`;
      await pool.query(query, params);
    } catch (error: any) {
      logError('Mark bank statements as reconciled error', { statementIds, error: error.message });
      throw new Error(`Failed to mark bank statements as reconciled: ${error.message}`);
    }
  }

  /**
   * Mark multiple bank statements as unreconciled
   */
  async markBankStatementsAsUnreconciled(statementIds: string[], userId?: string): Promise<void> {
    try {
      const numericIds = statementIds.map(Number);
      const params: any[] = [false, new Date().toISOString(), numericIds];
      let query = "UPDATE bank_statements SET is_reconciled = $1, updated_at = $2";
      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      query += ` WHERE id = ANY($3)`;
      await pool.query(query, params);
    } catch (error: any) {
      logError('Mark bank statements as unreconciled error', { statementIds, error: error.message });
      throw new Error(`Failed to mark bank statements as unreconciled: ${error.message}`);
    }
  }

  /**
   * Add aggregates to a settlement group
   */
  async addAggregatesToGroup(
    settlementGroupId: string,
    aggregates: Array<{
      aggregateId: string;
      allocatedAmount: number;
      originalAmount: number;
    }>
  ): Promise<void> {
    try {
      if (aggregates.length === 0) return;
      const values: any[] = [];
      const placeholders = aggregates.map((agg, i) => {
        const base = i * 4;
        values.push(settlementGroupId, agg.aggregateId, agg.allocatedAmount, agg.originalAmount);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      }).join(", ");

      await pool.query(
        `INSERT INTO bank_settlement_aggregates (settlement_group_id, aggregate_id, allocated_amount, original_amount) VALUES ${placeholders}`,
        values
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error adding aggregates to settlement group", {
        settlementGroupId,
        count: aggregates.length,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Update settlement group status
   */
  async updateStatus(
    id: string,
    status: SettlementGroupStatus,
    confirmedAt?: string
  ): Promise<void> {
    try {
      const updateData: any[] = [status, new Date().toISOString(), id];
      let query = "UPDATE bank_settlement_groups SET status = $1, updated_at = $2";
      
      if (confirmedAt) {
        updateData.push(confirmedAt);
        query += `, confirmed_at = $${updateData.length}`;
      }
      query += ` WHERE id = $3`;

      await pool.query(query, updateData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error updating settlement group status", { id, status, error: errorMessage });
      throw error;
    }
  }

  /**
   * Mark aggregates as reconciled
   */
  async markAggregatesAsReconciled(aggregateIds: string[]): Promise<void> {
    try {
      await pool.query(
        "UPDATE aggregated_transactions SET is_reconciled = true, updated_at = $1 WHERE id = ANY($2)",
        [new Date().toISOString(), aggregateIds]
      );
    } catch (error: any) {
      logError('Mark aggregates as reconciled error', { aggregateIds, error: error.message });
      throw new Error(`Failed to mark aggregates as reconciled: ${error.message}`);
    }
  }

  /**
   * Mark bank statement as reconciled
   */
  async markBankStatementAsReconciled(statementId: string, userId?: string): Promise<void> {
    try {
      const params: any[] = [true, new Date().toISOString(), Number(statementId)];
      let query = "UPDATE bank_statements SET is_reconciled = $1, updated_at = $2";
      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      query += ` WHERE id = $3`;
      await pool.query(query, params);
    } catch (error: any) {
      logError('Mark bank statement as reconciled error', { statementId, error: error.message });
      throw new Error(`Failed to mark bank statement as reconciled: ${error.message}`);
    }
  }

  /**
   * Mark aggregates as unreconciled
   */
  async markAggregatesAsUnreconciled(aggregateIds: string[]): Promise<void> {
    try {
      await pool.query(
        "UPDATE aggregated_transactions SET is_reconciled = false, updated_at = $1 WHERE id = ANY($2)",
        [new Date().toISOString(), aggregateIds]
      );
    } catch (error: any) {
      logError('Mark aggregates as unreconciled error', { aggregateIds, error: error.message });
      throw new Error(`Failed to mark aggregates as unreconciled: ${error.message}`);
    }
  }

  /**
   * Mark bank statement as unreconciled
   */
  async markBankStatementAsUnreconciled(statementId: string, userId?: string): Promise<void> {
    try {
      const params: any[] = [false, new Date().toISOString(), Number(statementId)];
      let query = "UPDATE bank_statements SET is_reconciled = $1, updated_at = $2";
      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      query += ` WHERE id = $3`;
      await pool.query(query, params);
    } catch (error: any) {
      logError('Mark bank statement as unreconciled error', { statementId, error: error.message });
      throw new Error(`Failed to mark bank statement as unreconciled: ${error.message}`);
    }
  }

  /**
   * Hard delete settlement group and its aggregates + statements
   */
  async hardDelete(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("DELETE FROM bank_settlement_statements WHERE settlement_group_id = $1", [id]);
      await client.query("DELETE FROM bank_settlement_aggregates WHERE settlement_group_id = $1", [id]);
      await client.query("DELETE FROM bank_settlement_groups WHERE id = $1", [id]);
      await client.query('COMMIT');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error hard deleting settlement group", { id, error: errorMessage });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get list of settlement groups with pagination and filters
   */
  async findAll(options?: {
    startDate?: string;
    endDate?: string;
    status?: SettlementGroupStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    try {
      const params: any[] = [];
      const conditions: string[] = ["bsg.deleted_at IS NULL"];

      if (options?.startDate) {
        params.push(options.startDate);
        conditions.push(`bsg.settlement_date >= $${params.length}::date`);
      }
      if (options?.endDate) {
        params.push(options.endDate);
        conditions.push(`bsg.settlement_date <= $${params.length}::date`);
      }
      if (options?.status) {
        params.push(options.status);
        conditions.push(`bsg.status = $${params.length}`);
      }
      if (options?.search) {
        params.push(`%${options.search}%`);
        conditions.push(`(bsg.settlement_number ILIKE $${params.length} OR bsg.notes ILIKE $${params.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Total count
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as total FROM bank_settlement_groups bsg ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // Data query
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const dataParams = [...params, limit, offset];
      const dataQuery = `
        SELECT bsg.*
        FROM bank_settlement_groups bsg
        ${whereClause}
        ORDER BY bsg.created_at DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `;

      const { rows } = await pool.query(dataQuery, dataParams);

      const groupIds = rows.map((g) => g.id);
      const aggregatesMap = await this.batchFetchAggregatesForGroups(groupIds);
      const statementsMap = await this.batchFetchStatementsForGroups(groupIds);

      const transformedData = rows.map((group) => ({
        ...group,
        bank_statement_id: safeBankStatementIdToString(group.bank_statement_id),
        statements: statementsMap[group.id] || [],
        aggregates: aggregatesMap[group.id] || [],
      }));

      return { data: transformedData, total };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement groups", { options, error: errorMessage });
      throw error;
    }
  }

  /**
   * Batch fetch statements for multiple groups from junction table
   */
  private async batchFetchStatementsForGroups(
    groupIds: string[]
  ): Promise<Record<string, any[]>> {
    const result: Record<string, any[]> = {};
    if (groupIds.length === 0) return result;

    try {
      const query = `
        SELECT 
          bss.settlement_group_id,
          bs.id, bs.transaction_date, bs.description,
          bs.debit_amount, bs.credit_amount,
          (bs.credit_amount - bs.debit_amount) as amount,
          b.bank_name
        FROM bank_settlement_statements bss
        JOIN bank_statements bs ON bss.bank_statement_id = bs.id
        LEFT JOIN bank_accounts ba ON bs.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        WHERE bss.settlement_group_id = ANY($1)
        ORDER BY bs.transaction_date ASC
      `;
      const { rows } = await pool.query(query, [groupIds]);

      for (const row of rows) {
        const gid = row.settlement_group_id;
        if (!result[gid]) result[gid] = [];
        result[gid].push({ ...row, id: String(row.id), settlement_group_id: undefined });
      }
    } catch (error) {
      logError("Error in batchFetchStatementsForGroups", {
        groupCount: groupIds.length,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    return result;
  }

  /**
   * Batch fetch aggregates for multiple groups
   */
  private async batchFetchAggregatesForGroups(
    groupIds: string[]
  ): Promise<Record<string, any[]>> {
    const result: Record<string, any[]> = {};
    if (groupIds.length === 0) return result;

    try {
      const query = `
        SELECT 
          bsa.*,
          jsonb_build_object(
            'id', at.id,
            'transaction_date', at.transaction_date,
            'gross_amount', at.gross_amount,
            'nett_amount', at.nett_amount,
            'actual_nett_amount', COALESCE(at.actual_nett_amount, at.nett_amount),
            'payment_method_name', pm.name,
            'payment_method_id', at.payment_method_id,
            'branch_name', at.branch_name
          ) as aggregate
        FROM bank_settlement_aggregates bsa
        LEFT JOIN aggregated_transactions at ON bsa.aggregate_id = at.id
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        WHERE bsa.settlement_group_id = ANY($1)
        ORDER BY bsa.created_at ASC
      `;
      
      const { rows } = await pool.query(query, [groupIds]);

      for (const sa of rows) {
        const entry = {
          ...sa,
          allocated_amount: Number(sa.allocated_amount) || 0,
          original_amount: Number(sa.original_amount) || 0,
          aggregate: sa.aggregate.id ? sa.aggregate : null
        };
        if (!result[sa.settlement_group_id]) result[sa.settlement_group_id] = [];
        result[sa.settlement_group_id].push(entry);
      }
    } catch (error) {
      logError("Error in batchFetchAggregatesForGroups", {
        groupCount: groupIds.length,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    return result;
  }

  /**
   * Get aggregates for a settlement group
   */
  async getAggregatesByGroupId(settlementGroupId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          bsa.*,
          jsonb_build_object(
            'id', at.id,
            'transaction_date', at.transaction_date,
            'gross_amount', at.gross_amount,
            'nett_amount', at.nett_amount,
            'actual_nett_amount', COALESCE(at.actual_nett_amount, at.nett_amount),
            'payment_method_name', pm.name,
            'payment_method_id', at.payment_method_id,
            'branch_name', at.branch_name
          ) as aggregate
        FROM bank_settlement_aggregates bsa
        LEFT JOIN aggregated_transactions at ON bsa.aggregate_id = at.id
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        WHERE bsa.settlement_group_id = $1
        ORDER BY bsa.created_at ASC
      `;
      
      const { rows } = await pool.query(query, [settlementGroupId]);

      return rows.map(sa => ({
        ...sa,
        allocated_amount: Number(sa.allocated_amount) || 0,
        original_amount: Number(sa.original_amount) || 0,
        aggregate: sa.aggregate.id ? sa.aggregate : null
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching settlement group aggregates", { settlementGroupId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if aggregate is already in any settlement group
   */
  async isAggregateInSettlementGroup(aggregateId: string): Promise<boolean> {
    try {
      const { rows } = await pool.query(
        "SELECT id FROM bank_settlement_aggregates WHERE aggregate_id = $1 LIMIT 1",
        [aggregateId]
      );
      return rows.length > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error checking if aggregate is in settlement group", { aggregateId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get available aggregates for settlement
   */
  async getAvailableAggregates(options?: {
    startDate?: string;
    endDate?: string;
    paymentMethodId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    try {
      const params: any[] = [false];
      const conditions: string[] = ["at.is_reconciled = $1", "at.deleted_at IS NULL", "at.superseded_by IS NULL", "at.nett_amount > 0"];

      if (options?.startDate) {
        params.push(options.startDate);
        conditions.push(`at.transaction_date >= $${params.length}::date`);
      }
      if (options?.endDate) {
        params.push(options.endDate);
        conditions.push(`at.transaction_date <= $${params.length}::date`);
      }
      if (options?.paymentMethodId) {
        params.push(options.paymentMethodId);
        conditions.push(`at.payment_method_id = $${params.length}`);
      }
      if (options?.search) {
        params.push(`%${options.search}%`);
        conditions.push(`(at.id::text ILIKE $${params.length} OR pm.name ILIKE $${params.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as total FROM aggregated_transactions at LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      const limit = options?.limit || 100;
      const offset = options?.offset || 0;
      const dataParams = [...params, limit, offset];
      const dataQuery = `
        SELECT 
          at.id, at.transaction_date, at.gross_amount, at.nett_amount,
          COALESCE(at.actual_nett_amount, at.nett_amount) as actual_nett_amount,
          pm.name as payment_method_name, at.payment_method_id,
          at.branch_name, at.is_reconciled
        FROM aggregated_transactions at
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        ${whereClause}
        ORDER BY at.transaction_date DESC, at.nett_amount DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `;

      const { rows } = await pool.query(dataQuery, dataParams);
      return { data: rows, total };
    } catch (error: any) {
      logError("Error fetching available aggregates", { options, error: error.message });
      throw error;
    }
  }

  /**
   * Get aggregate by ID
   */
  async getAggregateById(aggregateId: string): Promise<any> {
    try {
      const query = `
        SELECT 
          at.id, at.transaction_date, at.gross_amount, at.nett_amount,
          COALESCE(at.actual_nett_amount, at.nett_amount) as actual_nett_amount,
          pm.name as payment_method_name, at.payment_method_id,
          at.branch_name, at.is_reconciled
        FROM aggregated_transactions at
        LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
        WHERE at.id = $1
      `;
      const { rows } = await pool.query(query, [aggregateId]);
      return rows[0] || null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching aggregate by ID", { aggregateId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if any aggregates in the group are reconciled by a DIFFERENT settlement group.
   * Returns true only if an aggregate has been re-reconciled elsewhere — which would
   * block the undo of the current group.
   */
  async checkAggregatesReconciledElsewhere(groupId: string): Promise<boolean> {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int as count
         FROM bank_settlement_aggregates bsa
         JOIN aggregated_transactions at ON bsa.aggregate_id = at.id
         WHERE bsa.settlement_group_id = $1
           AND at.is_reconciled = true
           AND EXISTS (
             SELECT 1 FROM bank_settlement_aggregates bsa2
             WHERE bsa2.aggregate_id = bsa.aggregate_id
               AND bsa2.settlement_group_id <> $1
           )`,
        [groupId]
      );
      return rows[0].count > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError("Error checking aggregates reconciled elsewhere", { groupId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Find active settlement group by bank_statement_id
   * Checks both legacy column AND junction table
   */
  async findByBankStatementId(bankStatementId: string): Promise<{ id: string; status: string } | null> {
    try {
      // Check junction table first (new pattern)
      const { rows } = await pool.query(
        `SELECT bsg.id, bsg.status FROM bank_settlement_statements bss
         JOIN bank_settlement_groups bsg ON bss.settlement_group_id = bsg.id
         WHERE bss.bank_statement_id = $1 AND bsg.deleted_at IS NULL
         LIMIT 1`,
        [Number(bankStatementId)]
      );
      if (rows.length > 0) return rows[0];

      // Fallback: check legacy column
      const { rows: legacyRows } = await pool.query(
        "SELECT id, status FROM bank_settlement_groups WHERE bank_statement_id = $1 AND deleted_at IS NULL LIMIT 1",
        [Number(bankStatementId)]
      );
      return legacyRows[0] || null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError("Error in findByBankStatementId", { bankStatementId, error: errorMessage });
      return null;
    }
  }

  /**
   * Get bank statement ID directly from database
   */
  async getBankStatementIdRaw(settlementGroupId: string): Promise<string | null> {
    try {
      const { rows } = await pool.query(
        "SELECT bank_statement_id FROM bank_settlement_groups WHERE id = $1",
        [settlementGroupId]
      );
      return rows[0]?.bank_statement_id ? String(rows[0].bank_statement_id) : null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching bank_statement_id raw", { settlementGroupId, error: errorMessage });
      return null;
    }
  }

  /**
   * Get bank statement by ID
   */
  async getBankStatementById(statementId: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          bs.*,
          jsonb_build_object(
            'account_name', ba.account_name,
            'account_number', ba.account_number,
            'banks', jsonb_build_object('bank_name', b.bank_name, 'bank_code', b.bank_code)
          ) as bank_accounts
        FROM bank_statements bs
        LEFT JOIN bank_accounts ba ON bs.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        WHERE bs.id = $1
      `;
      const { rows } = await pool.query(query, [Number(statementId)]);
      if (rows.length === 0) return null;

      const data = rows[0];
      return {
        ...data,
        id: String(data.id),
        amount: (data.credit_amount || 0) - (data.debit_amount || 0),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logError("Error fetching bank statement by ID", { statementId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Transform raw database response to settlement group format
   */
  private transformSettlementGroup(data: any, aggregates: any[] = [], statements: any[] = []): any {
    return {
      ...data,
      bank_statement_id: safeBankStatementIdToString(data.bank_statement_id),
      statements,
      aggregates,
    };
  }
}

export const settlementGroupRepository = new SettlementGroupRepository();
