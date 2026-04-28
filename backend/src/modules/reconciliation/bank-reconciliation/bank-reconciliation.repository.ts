import { pool } from "../../../config/db";
import { PoolClient } from "pg";
import { logError } from "../../../config/logger";
import { BankReconciliationStatus } from "./bank-reconciliation.types";
import {
  FetchStatementError,
  StatementNotFoundError,
  DatabaseConnectionError,
} from "./bank-reconciliation.errors";

// ---------------------------------------------------------------------------
// Local types for method return shapes
// ---------------------------------------------------------------------------

interface ReconciliationGroupDetail {
  group_id: string;
  statement_id: string;
  amount: number;
  bank_statements: {
    id: string;
    transaction_date: string;
    description: string | null;
    debit_amount: number;
    credit_amount: number;
  } | null;
}

/** Shape returned by getReconciliationGroupById */
export interface ReconciliationGroupWithDetails {
  id: string;
  aggregate_id: string;
  company_id: string | null;
  total_bank_amount: number;
  aggregate_amount: number;
  difference: number;
  status: string;
  notes: string | null;
  reconciled_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined aggregate data as jsonb */
  aggregated_transactions: {
    id: string;
    transaction_date: string;
    gross_amount: number;
    nett_amount: number;
    payment_methods: { name: string | null };
  } | null;
  bank_reconciliation_group_details: ReconciliationGroupDetail[];
}

export class BankReconciliationRepository {
  constructor() {}

  /**
   * Find bank statement by ID
   */
  async findById(id: string): Promise<any> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM bank_statements WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
        [id]
      );

      if (rows.length === 0) {
        throw new StatementNotFoundError(id);
      }

      return rows[0];
    } catch (error: any) {
      if (error instanceof StatementNotFoundError) {
        throw error;
      }
      logError("Error fetching statement by ID", {
        statementId: id,
        error: error.message,
      });
      throw new FetchStatementError(id, error.message);
    }
  }

  /**
   * Get unreconciled bank statements for a company on a specific date
   */
  async getUnreconciled(startDate: Date, endDate?: Date): Promise<any[]> {
    const end = endDate || startDate;

    try {
      const { rows } = await pool.query(
        `SELECT * FROM bank_statements 
         WHERE transaction_date >= $1::date AND transaction_date <= $2::date 
           AND is_reconciled = false AND deleted_at IS NULL 
         ORDER BY transaction_date DESC, created_at DESC`,
        [startDate.toISOString().split("T")[0], end.toISOString().split("T")[0]]
      );

      return rows;
    } catch (error: any) {
      logError("Error fetching unreconciled statements", {
        startDate: startDate.toISOString(),
        endDate: end.toISOString(),
        error: error.message,
      });
      throw new FetchStatementError("unreconciled-list", error.message);
    }
  }

  /**
   * Get bank statements by date range with optional filtering and joined data
   * When dates are not provided, queries overall date range across all imports
   *
   * NOTE: This method fetches matched_aggregate data separately for statements with reconciliation_id
   */
  async getByDateRange(
    startDate?: Date,
    endDate?: Date,
    bankAccountIds?: number[],
    options?: {
      status?: "RECONCILED" | "UNRECONCILED";
      search?: string;
      isReconciled?: boolean;
      creditOnly?: boolean;
      sortField?: string;
      sortOrder?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    try {
      const params: any[] = [];
      const conditions: string[] = ["bs.deleted_at IS NULL"];

      if (startDate) {
        params.push(startDate.toISOString().split("T")[0]);
        conditions.push(`bs.transaction_date >= $${params.length}::date`);
      }
      if (endDate) {
        params.push(endDate.toISOString().split("T")[0]);
        conditions.push(`bs.transaction_date <= $${params.length}::date`);
      }
      if (bankAccountIds && bankAccountIds.length > 0) {
        params.push(bankAccountIds);
        conditions.push(`bs.bank_account_id = ANY($${params.length})`);
      }
      if (options?.status === "RECONCILED" || options?.isReconciled === true) {
        conditions.push("bs.is_reconciled = true");
      } else if (options?.status === "UNRECONCILED" || options?.isReconciled === false) {
        conditions.push("bs.is_reconciled = false");
      }
      if (options?.search) {
        params.push(`%${options.search}%`);
        conditions.push(`(bs.description ILIKE $${params.length} OR bs.reference_number ILIKE $${params.length})`);
      }
      if (options?.creditOnly) {
        conditions.push("bs.credit_amount > 0");
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Count Query
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int as total FROM bank_statements bs ${whereClause}`,
        params
      );
      const total = countRows[0].total;

      // Data Query
      const sortField = options?.sortField || "transaction_date";
      const sortOrder = options?.sortOrder || "desc";
      let dataQuery = `
        SELECT 
          bs.*,
          jsonb_build_object(
            'id', ba.id,
            'account_name', ba.account_name,
            'account_number', ba.account_number,
            'banks', jsonb_build_object(
              'bank_name', b.bank_name,
              'bank_code', b.bank_code
            )
          ) as bank_accounts
        FROM bank_statements bs
        LEFT JOIN bank_accounts ba ON bs.bank_account_id = ba.id
        LEFT JOIN banks b ON ba.bank_id = b.id
        ${whereClause}
        ORDER BY bs.${sortField} ${sortOrder === "asc" ? "ASC" : "DESC"}
      `;

      if (options?.limit) {
        params.push(options.limit);
        dataQuery += ` LIMIT $${params.length}`;
      }
      if (options?.offset) {
        params.push(options.offset);
        dataQuery += ` OFFSET $${params.length}`;
      }

      const { rows: data } = await pool.query(dataQuery, params);

      // ── 1:1 match: fetch aggregates via reconciliation_id ──
      const statementsWithReconciliation = data.filter((s) => s.reconciliation_id);
      const aggregateIds = [...new Set(statementsWithReconciliation.map((s) => s.reconciliation_id))];

      let aggregateMap: Record<string, any> = {};
      if (aggregateIds.length > 0) {
        const { rows: aggregates } = await pool.query(
          `SELECT 
             at.id, at.transaction_date, at.gross_amount, at.nett_amount,
             pm.name as payment_method_name
           FROM aggregated_transactions at
           JOIN payment_methods pm ON at.payment_method_id = pm.id
           WHERE at.id = ANY($1)`,
          [aggregateIds]
        );
        aggregateMap = aggregates.reduce((acc, agg) => ({ ...acc, [agg.id]: agg }), {});
      }

      // ── Multi-match: fetch group data via reconciliation_group_id ──
      const statementsWithGroup = data.filter((s) => s.reconciliation_group_id && !s.reconciliation_id);
      const groupIds = [...new Set(statementsWithGroup.map((s) => s.reconciliation_group_id))];

      let groupDataMap: Record<string, any> = {};
      if (groupIds.length > 0) {
        const { rows: groups } = await pool.query(
          `SELECT 
             brg.id, brg.aggregate_id, brg.total_bank_amount, brg.aggregate_amount, brg.difference,
             at.id as aggregate_id_at, at.transaction_date, at.gross_amount, at.nett_amount,
             pm.name as payment_method_name
           FROM bank_reconciliation_groups brg
           LEFT JOIN aggregated_transactions at ON brg.aggregate_id = at.id
           LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
           WHERE brg.id = ANY($1) AND brg.deleted_at IS NULL`,
          [groupIds]
        );
        groupDataMap = groups.reduce((acc, grp) => ({ ...acc, [grp.id]: grp }), {});
      }

      // ── Settlement groups: fetch via bank_statement_id ──
      const reconciledWithoutLinkIds = data
        .filter((s) => s.is_reconciled && !s.reconciliation_id && !s.reconciliation_group_id)
        .map((s) => s.id);

      let settlementMap: Record<string, any> = {};
      if (reconciledWithoutLinkIds.length > 0) {
        const { rows: settlements } = await pool.query(
          `SELECT 
             bsg.id, bsg.bank_statement_id, bsg.total_statement_amount, bsg.total_allocated_amount, bsg.difference, bsg.status,
             COALESCE(jsonb_agg(bsa.*) FILTER (WHERE bsa.id IS NOT NULL), '[]') as bank_settlement_aggregates
           FROM bank_settlement_groups bsg
           LEFT JOIN bank_settlement_aggregates bsa ON bsg.id = bsa.group_id
           WHERE bsg.bank_statement_id = ANY($1) AND bsg.deleted_at IS NULL
           GROUP BY bsg.id`,
          [reconciledWithoutLinkIds]
        );
        settlementMap = settlements.reduce((acc, sg) => ({ ...acc, [String(sg.bank_statement_id)]: sg }), {});
      }

      // ── Cash deposits: fetch via cash_deposit_id ──
      const cashDepositIds = [...new Set(data.filter((s) => s.cash_deposit_id).map((s) => s.cash_deposit_id))];

      let cashDepositMap: Record<string, any> = {};
      if (cashDepositIds.length > 0) {
        const { rows: deposits } = await pool.query(
          "SELECT id, deposit_amount, deposit_date, branch_name, bank_account_id, status, proof_url, deposited_at FROM cash_deposits WHERE id = ANY($1)",
          [cashDepositIds]
        );
        cashDepositMap = deposits.reduce((acc, dep) => ({ ...acc, [dep.id]: dep }), {});
      }

      // Map data to include matched_aggregate
      const mappedData = data.map((row) => {
        if (row.reconciliation_id && aggregateMap[row.reconciliation_id]) {
          const agg = aggregateMap[row.reconciliation_id];
          return {
            ...row,
            matched_aggregate: {
              id: agg.id,
              transaction_date: agg.transaction_date,
              gross_amount: agg.gross_amount,
              nett_amount: agg.nett_amount,
              payment_method_name: agg.payment_method_name || null,
            },
          };
        }
        if (row.reconciliation_group_id && groupDataMap[row.reconciliation_group_id]) {
          const grp = groupDataMap[row.reconciliation_group_id];
          const agg = grp.aggregated_transactions;
          return {
            ...row,
            matched_aggregate: {
              id: grp.aggregate_id_at || grp.aggregate_id,
              transaction_date: grp.transaction_date || null,
              gross_amount: grp.gross_amount || 0,
              nett_amount: Number(grp.aggregate_amount) || 0,
              payment_method_name: grp.payment_method_name || null,
              is_multi_match: true,
              group_total_bank_amount: Number(grp.total_bank_amount) || 0,
              group_difference: Number(grp.difference) || 0,
            },
          };
        }
        const rowId = String(row.id);
        if (row.is_reconciled && settlementMap[rowId]) {
          const sg = settlementMap[rowId];
          return {
            ...row,
            matched_aggregate: {
              id: sg.id,
              transaction_date: null,
              gross_amount: 0,
              nett_amount: Number(sg.total_allocated_amount) || 0,
              payment_method_name: null,
              is_settlement: true,
              settlement_aggregate_count: sg.bank_settlement_aggregates?.length || 0,
              group_total_bank_amount: Number(sg.total_statement_amount) || 0,
              group_difference: Number(sg.difference) || 0,
            },
          };
        }
        if (row.cash_deposit_id && cashDepositMap[row.cash_deposit_id]) {
          const dep = cashDepositMap[row.cash_deposit_id];
          return {
            ...row,
            matched_aggregate: {
              id: dep.id,
              transaction_date: dep.deposit_date,
              gross_amount: Number(dep.deposit_amount) || 0,
              nett_amount: Number(dep.deposit_amount) || 0,
              payment_method_name: "Setoran Tunai",
              is_cash_deposit: true,
              branch_name: dep.branch_name,
              proof_url: dep.proof_url,
              deposited_at: dep.deposited_at,
            },
          };
        }
        if (row.bank_mutation_entry_id) {
          return {
            ...row,
            matched_aggregate: {
              id: row.bank_mutation_entry_id,
              transaction_date: row.transaction_date,
              gross_amount: Math.abs((row.credit_amount || 0) - (row.debit_amount || 0)),
              nett_amount: Math.abs((row.credit_amount || 0) - (row.debit_amount || 0)),
              payment_method_name: "Manual Entry",
              is_bank_mutation_entry: true,
            },
          };
        }
        return { ...row, matched_aggregate: null };
      });

      return { data: mappedData, total };
    } catch (error: any) {
      logError("Error fetching statements by date range", {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all bank accounts without any date filter
   */
  async getAllBankAccounts(): Promise<any[]> {
    try {
      const { rows: activeIdsRows } = await pool.query(
        "SELECT DISTINCT bank_account_id FROM bank_statements WHERE deleted_at IS NULL"
      );
      const uniqueIds = activeIdsRows.map((r) => r.bank_account_id);

      let query = `
        SELECT 
          ba.id, ba.account_name, ba.account_number,
          jsonb_build_object('bank_name', b.bank_name, 'bank_code', b.bank_code) as banks
        FROM bank_accounts ba
        JOIN banks b ON ba.bank_id = b.id
        WHERE ba.deleted_at IS NULL
      `;
      const params: any[] = [];

      if (uniqueIds.length > 0) {
        params.push(uniqueIds);
        query += " AND ba.id = ANY($1)";
      }

      query += " ORDER BY ba.account_name ASC";
      const { rows } = await pool.query(query, params);

      return rows.map((acc) => ({
        ...acc,
        stats: { total: 0, unreconciled: 0 },
      }));
    } catch (error: any) {
      logError("Error fetching all bank accounts", { error: error.message });
      throw new DatabaseConnectionError("fetching all bank accounts", error.message);
    }
  }

  /**
   * Get list of bank accounts with reconciliation summaries for a period
   */
  async getBankAccountsStatus(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const { rows: statsRows } = await pool.query(
        `SELECT bank_account_id, is_reconciled FROM bank_statements 
         WHERE transaction_date >= $1::date AND transaction_date <= $2::date AND deleted_at IS NULL`,
        [startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]]
      );

      const stats = statsRows.reduce((acc: any, curr: any) => {
        const bId = curr.bank_account_id;
        if (!acc[bId]) acc[bId] = { total: 0, unreconciled: 0 };
        acc[bId].total++;
        if (!curr.is_reconciled) acc[bId].unreconciled++;
        return acc;
      }, {});

      const accountIds = Object.keys(stats).map((id) => parseInt(id));
      if (accountIds.length === 0) return [];

      const { rows: accounts } = await pool.query(
        `SELECT 
           ba.id, ba.account_name, ba.account_number,
           jsonb_build_object('bank_name', b.bank_name, 'bank_code', b.bank_code) as banks
         FROM bank_accounts ba
         JOIN banks b ON ba.bank_id = b.id
         WHERE ba.id = ANY($1)`,
        [accountIds]
      );

      return accounts.map((acc) => ({
        ...acc,
        stats: stats[acc.id],
      }));
    } catch (error: any) {
      logError("Error fetching bank accounts status", { error: error.message });
      throw new DatabaseConnectionError("fetching bank accounts status", error.message);
    }
  }

  /**
   * Update reconciliation status of a bank statement
   */
  async updateStatus(
    id: string,
    status: BankReconciliationStatus,
    userId?: string,
  ): Promise<void> {
    try {
      const isReconciled = status === BankReconciliationStatus.RECONCILED;
      const params: any[] = [isReconciled, new Date().toISOString()];
      let query = "UPDATE bank_statements SET is_reconciled = $1, updated_at = $2";

      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      params.push(id);
      query += ` WHERE id = $${params.length}`;

      await pool.query(query, params);
    } catch (error: any) {
      logError("Error updating statement status", {
        statementId: id,
        error: error.message,
      });
      throw new FetchStatementError(id, error.message);
    }
  }

  /**
   * Mark a statement as reconciled with a specific aggregate
   */
  async markAsReconciled(
    statementId: string,
    aggregateId: string,
    userId?: string,
  ): Promise<void> {
    try {
      const { rows: aggregateRows } = await pool.query(
        "SELECT payment_method_id FROM aggregated_transactions WHERE id = $1 LIMIT 1",
        [aggregateId]
      );
      const aggregate = aggregateRows[0];

      const params: any[] = [true, false, aggregateId, new Date().toISOString()];
      let query = `
        UPDATE bank_statements
        SET is_reconciled = $1, is_pending = $2, reconciliation_id = $3, updated_at = $4
      `;

      if (aggregate?.payment_method_id) {
        params.push(aggregate.payment_method_id);
        query += `, payment_method_id = $${params.length}`;
      }
      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      params.push(statementId);
      query += ` WHERE id = $${params.length}`;

      await pool.query(query, params);
    } catch (error: any) {
      logError("Error marking statement as reconciled", {
        statementId,
        aggregateId,
        error: error.message,
      });
      throw new FetchStatementError(statementId, error.message);
    }
  }

  /**
   * Bulk update status for multiple statements
   */
  async bulkUpdateReconciliationStatus(
    ids: string[],
    isReconciled: boolean,
    userId?: string,
  ): Promise<void> {
    try {
      const params: any[] = [isReconciled, new Date().toISOString()];
      let query = "UPDATE bank_statements SET is_reconciled = $1, updated_at = $2";

      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      params.push(ids);
      query += ` WHERE id = ANY($${params.length})`;

      await pool.query(query, params);
    } catch (error: any) {
      logError("Error bulk updating reconciliation status", {
        count: ids.length,
        error: error.message,
      });
      throw new DatabaseConnectionError("bulk update reconciliation status", error.message);
    }
  }

  async countReconciledStatementsInGroup(groupId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as count 
       FROM bank_reconciliation_group_details brgd
       JOIN bank_statements bs ON brgd.statement_id = bs.id
       WHERE brgd.group_id = $1 AND bs.is_reconciled = true`,
      [groupId]
    );
    return rows[0].count;
  }

  /**
   * Get unreconciled statements in batches for large datasets
   */
  async getUnreconciledBatch(
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
    offset: number = 0,
    bankAccountId?: number,
  ): Promise<any[]> {
    try {
      const params: any[] = [
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
        limit,
        offset
      ];
      let query = `
        SELECT * FROM bank_statements 
        WHERE transaction_date >= $1::date AND transaction_date <= $2::date 
          AND is_reconciled = false AND deleted_at IS NULL
      `;

      if (bankAccountId) {
        params.push(bankAccountId);
        query += ` AND bank_account_id = $${params.length}`;
      }

      query += ` ORDER BY transaction_date DESC, created_at DESC LIMIT $3 OFFSET $4`;
      
      const { rows } = await pool.query(query, params);
      return rows;
    } catch (error: any) {
      logError("Error fetching unreconciled batch", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit,
        offset,
        error: error.message,
      });
      throw new FetchStatementError("batch-fetch", error.message);
    }
  }

  /**
   * Count total unreconciled bank statements (for pagination)
   */
  async countUnreconciled(
    startDate: Date,
    endDate: Date,
    bankAccountId?: number,
  ): Promise<number> {
    try {
      const params: any[] = [
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
      ];
      let query = `
        SELECT COUNT(*)::int as count FROM bank_statements 
        WHERE transaction_date >= $1::date AND transaction_date <= $2::date 
          AND is_reconciled = false AND deleted_at IS NULL
      `;

      if (bankAccountId) {
        params.push(bankAccountId);
        query += ` AND bank_account_id = $${params.length}`;
      }

      const { rows } = await pool.query(query, params);
      return rows[0].count;
    } catch (error: any) {
      logError("Error counting unreconciled statements", { error: error.message });
      return 0;
    }
  }

  /**
   * Log reconciliation action to audit trail
   */
  async logAction(data: {
    companyId: string;
    userId?: string;
    action:
      | "MANUAL_RECONCILE"
      | "AUTO_MATCH"
      | "AUTO_MATCH_CASH_DEPOSIT"
      | "UNDO"
      | "UNDO_CASH_DEPOSIT"
      | "CREATE_MULTI_MATCH"
      | "UNDO_MULTI_MATCH";
    statementId?: string;
    aggregateId?: string;
    details?: any;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO bank_reconciliation_logs 
         (company_id, user_id, action, statement_id, aggregate_id, details) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.companyId, data.userId, data.action, data.statementId, data.aggregateId, data.details || {}]
      );
    } catch (error: any) {
      logError("Error logging reconciliation action", {
        action: data.action,
        companyId: data.companyId,
        error: error.message,
      });
    }
  }

  /**
   * Undo reconciliation for a specific statement.
   */
  async undoReconciliation(
    statementId: string,
    userId?: string,
  ): Promise<void> {
    try {
      const { rows } = await pool.query(
        "SELECT reconciliation_id FROM bank_statements WHERE id = $1 LIMIT 1",
        [statementId]
      );
      const reconciliationId = rows[0]?.reconciliation_id;

      const params: any[] = [false, null, null, new Date().toISOString()];
      let query = "UPDATE bank_statements SET is_reconciled = $1, reconciliation_id = $2, reconciliation_group_id = $3, updated_at = $4";

      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      params.push(statementId);
      query += ` WHERE id = $${params.length}`;

      await pool.query(query, params);

      if (reconciliationId) {
        await pool.query(
          `UPDATE aggregated_transactions 
           SET is_reconciled = false, actual_fee_amount = 0, fee_discrepancy = 0, fee_discrepancy_note = null, updated_at = $1 
           WHERE id = $2`,
          [new Date().toISOString(), reconciliationId]
        );
      }
    } catch (error: any) {
      logError("Error undoing reconciliation", {
        statementId,
        error: error.message,
      });
      throw new FetchStatementError(statementId, error.message);
    }
  }

  // =====================================================
  // MULTI-MATCH REPOSITORY METHODS
  // =====================================================

  /**
   * Create a reconciliation group with multiple statements
   */
  async createReconciliationGroup(data: {
    aggregateId: string;
    statementIds: string[];
    totalBankAmount: number;
    aggregateAmount: number;
    difference: number;
    notes?: string;
    reconciledBy?: string;
    companyId?: string;
  }): Promise<string> {
    try {
      const status = Math.abs(data.difference) <= 100 ? "RECONCILED" : "DISCREPANCY";
      const { rows } = await pool.query(
        `INSERT INTO bank_reconciliation_groups 
         (aggregate_id, company_id, total_bank_amount, aggregate_amount, difference, notes, reconciled_by, updated_at, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id`,
        [data.aggregateId, data.companyId, data.totalBankAmount, data.aggregateAmount, data.difference, data.notes, data.reconciledBy, new Date().toISOString(), status]
      );
      return rows[0].id;
    } catch (error: any) {
      throw new DatabaseConnectionError("creating reconciliation group", error.message);
    }
  }

  /**
   * Add statements to a reconciliation group
   */
  async addStatementsToGroup(
    groupId: string,
    statements: Array<{ statementId: string; amount: number }>,
  ): Promise<void> {
    try {
      if (statements.length === 0) return;
      const values: any[] = [];
      const placeholders = statements.map((s, i) => {
        const base = i * 3;
        values.push(groupId, s.statementId, s.amount);
        return `($${base + 1}, $${base + 2}, $${base + 3})`;
      }).join(", ");

      await pool.query(
        `INSERT INTO bank_reconciliation_group_details (group_id, statement_id, amount) VALUES ${placeholders}`,
        values
      );
    } catch (error: any) {
      logError("Error adding statements to group", {
        groupId,
        error: error.message,
      });
      throw new DatabaseConnectionError("adding statements to group", error.message);
    }
  }

  /**
   * Get reconciliation group by ID with all details.
   *
   * @param groupId - The group UUID to fetch
   * @param client  - Optional PoolClient to run within an existing transaction.
   *                  Pass the transactional client so reads see uncommitted writes
   *                  made earlier in the same transaction.
   */
  async getReconciliationGroupById(
    groupId: string,
    client?: PoolClient,
  ): Promise<ReconciliationGroupWithDetails | null> {
    const db = client ?? pool;
    try {
      const { rows: groupRows } = await db.query(
        `SELECT 
           brg.*,
           jsonb_build_object(
             'id', at.id,
             'transaction_date', at.transaction_date,
             'gross_amount', at.gross_amount,
             'nett_amount', at.nett_amount,
             'payment_methods', jsonb_build_object('name', pm.name)
           ) as aggregated_transactions
         FROM bank_reconciliation_groups brg
         LEFT JOIN aggregated_transactions at ON brg.aggregate_id = at.id
         LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
         WHERE brg.id = $1 AND brg.deleted_at IS NULL`,
        [groupId]
      );

      if (groupRows.length === 0) return null;

      const { rows: detailRows } = await db.query(
        `SELECT 
           brgd.*,
           jsonb_build_object(
             'id', bs.id,
             'transaction_date', bs.transaction_date,
             'description', bs.description,
             'debit_amount', bs.debit_amount,
             'credit_amount', bs.credit_amount
           ) as bank_statements
         FROM bank_reconciliation_group_details brgd
         LEFT JOIN bank_statements bs ON brgd.statement_id = bs.id
         WHERE brgd.group_id = $1`,
        [groupId]
      );

      return {
        ...groupRows[0],
        bank_reconciliation_group_details: detailRows
      };
    } catch (error: any) {
      logError("Error fetching reconciliation group", {
        groupId,
        error: error.message,
      });
      throw new FetchStatementError(`group-${groupId}`, error.message);
    }
  }

  /**
   * Mark statements as reconciled with a group
   */
  async markStatementsAsReconciledWithGroup(
    statementIds: string[],
    groupId: string,
    userId?: string,
  ): Promise<void> {
    try {
      const params: any[] = [true, false, groupId, new Date().toISOString()];
      let query = "UPDATE bank_statements SET is_reconciled = $1, is_pending = $2, reconciliation_group_id = $3, updated_at = $4";

      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      params.push(statementIds);
      query += ` WHERE id = ANY($${params.length})`;

      await pool.query(query, params);
    } catch (error: any) {
      logError("Error marking statements as reconciled with group", {
        count: statementIds.length,
        groupId,
        error: error.message,
      });
      throw new FetchStatementError("group-statements", error.message);
    }
  }

  /**
   * Undo reconciliation group
   */
  async undoReconciliationGroup(
    groupId: string,
    userId?: string,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Pass the transactional client so the read runs within the same transaction
      const group = await this.getReconciliationGroupById(groupId, client);
      if (!group) throw new Error("Group not found");

      const statementIds = (group.bank_reconciliation_group_details || []).map((d: any) => d.statement_id);

      // 1. Reset bank_statements
      if (statementIds.length > 0) {
        const params: any[] = [false, null, new Date().toISOString()];
        let query = "UPDATE bank_statements SET is_reconciled = $1, reconciliation_group_id = $2, updated_at = $3";
        if (userId) {
          params.push(userId);
          query += `, updated_by = $${params.length}`;
        }
        params.push(statementIds);
        query += ` WHERE id = ANY($${params.length})`;
        await client.query(query, params);
      }

      // 2. Reset aggregated_transactions if linked
      if (group.aggregate_id) {
        await client.query(
          `UPDATE aggregated_transactions 
           SET is_reconciled = false, actual_fee_amount = 0, fee_discrepancy = 0, fee_discrepancy_note = null, updated_at = $1 
           WHERE id = $2`,
          [new Date().toISOString(), group.aggregate_id]
        );
      }

      // 3. Soft delete group
      await client.query(
        `UPDATE bank_reconciliation_groups SET deleted_at = $1, status = 'UNDO', updated_at = $1 WHERE id = $2`,
        [new Date().toISOString(), groupId]
      );

      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      logError("Error undoing reconciliation group", {
        groupId,
        error: error.message,
      });
      throw new DatabaseConnectionError("undoing reconciliation group", error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Check if aggregate is already part of a group
   */
  async isAggregateInGroup(aggregateId: string): Promise<boolean> {
    try {
      const { rows } = await pool.query(
        "SELECT id FROM bank_reconciliation_groups WHERE aggregate_id = $1 AND deleted_at IS NULL LIMIT 1",
        [aggregateId]
      );
      return rows.length > 0;
    } catch (error: any) {
      logError("Error checking if aggregate is in group", {
        aggregateId,
        error: error.message,
      });
      throw new DatabaseConnectionError("checking aggregate group status", error.message);
    }
  }

  /**
   * Soft-delete a reconciliation group by marking it UNDO.
   *
   * @param client - Optional PoolClient to run within an existing transaction.
   */
  async softDeleteGroup(groupId: string, client?: PoolClient): Promise<void> {
    const db = client ?? pool;
    await db.query(
      `UPDATE bank_reconciliation_groups SET deleted_at = $1, status = 'UNDO', updated_at = $1 WHERE id = $2`,
      [new Date().toISOString(), groupId]
    );
  }

  /**
   * Get unreconciled statements by date range for suggestion algorithm
   */
  async getUnreconciledStatementsForSuggestion(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const { rows } = await pool.query(
        `SELECT id, transaction_date, description, debit_amount, credit_amount 
         FROM bank_statements 
         WHERE transaction_date >= $1::date AND transaction_date <= $2::date 
           AND is_reconciled = false AND deleted_at IS NULL 
         ORDER BY transaction_date DESC`,
        [startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]]
      );
      return rows;
    } catch (error: any) {
      logError("Error fetching statements for suggestion", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        error: error.message,
      });
      throw new FetchStatementError("suggestion-fetch", error.message);
    }
  }

  /**
   * Get all reconciliation groups for a company
   */
  async getReconciliationGroups(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const { rows: groups } = await pool.query(
        `SELECT 
           brg.*,
           jsonb_build_object(
             'id', at.id,
             'transaction_date', at.transaction_date,
             'gross_amount', at.gross_amount,
             'nett_amount', at.nett_amount,
             'payment_method_name', pm.name
           ) as aggregate
         FROM bank_reconciliation_groups brg
         JOIN aggregated_transactions at ON brg.aggregate_id = at.id
         LEFT JOIN payment_methods pm ON at.payment_method_id = pm.id
         WHERE at.transaction_date >= $1::date AND at.transaction_date <= $2::date 
           AND brg.deleted_at IS NULL 
         ORDER BY brg.created_at DESC`,
        [startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]]
      );

      if (groups.length === 0) return [];

      const groupIds = groups.map((g) => g.id);
      const { rows: detailsData } = await pool.query(
        `SELECT 
           brgd.*,
           jsonb_build_object(
             'id', bs.id,
             'transaction_date', bs.transaction_date,
             'description', bs.description,
             'debit_amount', bs.debit_amount,
             'credit_amount', bs.credit_amount
           ) as statement
         FROM bank_reconciliation_group_details brgd
         JOIN bank_statements bs ON brgd.statement_id = bs.id
         WHERE brgd.group_id = ANY($1)`,
        [groupIds]
      );

      const detailsMap = detailsData.reduce((acc, detail) => {
        if (!acc[detail.group_id]) acc[detail.group_id] = [];
        acc[detail.group_id].push(detail);
        return acc;
      }, {});

      return groups.map((group) => ({
        ...group,
        details: detailsMap[group.id] || []
      }));
    } catch (error: any) {
      logError("Error fetching reconciliation groups", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        error: error.message,
      });
      throw new DatabaseConnectionError("fetching reconciliation groups", error.message);
    }
  }

  async markAsReconciledCashDeposit(
    statementId: string,
    cashDepositId: string,
    userId?: string,
  ): Promise<void> {
    const params: any[] = [true, false, cashDepositId, new Date().toISOString()];
    let query = "UPDATE bank_statements SET is_reconciled = $1, is_pending = $2, cash_deposit_id = $3, updated_at = $4";
    if (userId) {
      params.push(userId);
      query += `, updated_by = $${params.length}`;
    }
    params.push(statementId);
    query += ` WHERE id = $${params.length}`;
    await pool.query(query, params);
  }

  async undoCashDepositReconciliation(
    statementId: string,
    cashDepositId: string,
    userId?: string,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const params: any[] = [false, null, new Date().toISOString()];
      let query = "UPDATE bank_statements SET is_reconciled = $1, cash_deposit_id = $2, updated_at = $3";
      if (userId) {
        params.push(userId);
        query += `, updated_by = $${params.length}`;
      }
      params.push(statementId);
      query += ` WHERE id = $${params.length}`;
      await client.query(query, params);

      await client.query(
        `UPDATE cash_deposits SET status = 'DEPOSITED', bank_statement_id = null, updated_at = $1 WHERE id = $2`,
        [new Date().toISOString(), cashDepositId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export const bankReconciliationRepository = new BankReconciliationRepository();
