import { supabase } from "../../../config/supabase";
import { logError } from "../../../config/logger";
import { BankReconciliationStatus } from "./bank-reconciliation.types";
import {
  FetchStatementError,
  StatementNotFoundError,
  DatabaseConnectionError,
} from "./bank-reconciliation.errors";

export class BankReconciliationRepository {
  constructor() {}

  /**
   * Find bank statement by ID
   */
  async findById(id: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new StatementNotFoundError(id);
      }

      return data;
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
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", end.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
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
    bankAccountId?: number,
    options?: {
      status?: "RECONCILED" | "UNRECONCILED";
      search?: string;
      isReconciled?: boolean;
      sortField?: string;
      sortOrder?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    try {
      let baseQuery = supabase
        .from("bank_statements")
        .select(
          `
        *,
        bank_accounts (
          id,
          account_name,
          account_number,
          banks (
            bank_name,
            bank_code
          )
        )
      `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Apply date range filters if provided
      if (startDate) {
        baseQuery = baseQuery.gte(
          "transaction_date",
          startDate.toISOString().split("T")[0],
        );
      }
      if (endDate) {
        baseQuery = baseQuery.lte(
          "transaction_date",
          endDate.toISOString().split("T")[0],
        );
      }

      // Apply bank account filter
      if (bankAccountId) {
        baseQuery = baseQuery.eq("bank_account_id", bankAccountId);
      }

      // Apply status filter
      if (options?.status === "RECONCILED") {
        baseQuery = baseQuery.eq("is_reconciled", true);
      } else if (options?.status === "UNRECONCILED") {
        baseQuery = baseQuery.eq("is_reconciled", false);
      }

      // Apply isReconciled filter (overrides status if both provided)
      if (options?.isReconciled !== undefined) {
        baseQuery = baseQuery.eq("is_reconciled", options.isReconciled);
      }

      // Apply search filter on description or reference_number
      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        baseQuery = baseQuery.or(
          `description.ilike.${searchTerm},reference_number.ilike.${searchTerm}`,
        );
      }

      // Get count query first (same filters as main query)
      let countQuery = supabase
        .from("bank_statements")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);

      if (startDate) {
        countQuery = countQuery.gte(
          "transaction_date",
          startDate.toISOString().split("T")[0],
        );
      }
      if (endDate) {
        countQuery = countQuery.lte(
          "transaction_date",
          endDate.toISOString().split("T")[0],
        );
      }
      if (bankAccountId) {
        countQuery = countQuery.eq("bank_account_id", bankAccountId);
      }
      if (options?.status === "RECONCILED") {
        countQuery = countQuery.eq("is_reconciled", true);
      } else if (options?.status === "UNRECONCILED") {
        countQuery = countQuery.eq("is_reconciled", false);
      }
      if (options?.isReconciled !== undefined) {
        countQuery = countQuery.eq("is_reconciled", options.isReconciled);
      }
      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        countQuery = countQuery.or(
          `description.ilike.${searchTerm},reference_number.ilike.${searchTerm}`,
        );
      }

      // Apply sorting
      const sortField = options?.sortField || "transaction_date";
      const sortOrder = options?.sortOrder || "desc";
      baseQuery = baseQuery.order(sortField, {
        ascending: sortOrder === "asc",
      });

      // Apply pagination
      if (options?.limit) {
        baseQuery = baseQuery.limit(options.limit);
      }
      if (options?.offset) {
        baseQuery = baseQuery.range(
          options.offset,
          options.offset + (options.limit || 100) - 1,
        );
      }

      const [{ data, error }, { count, error: countError }] = await Promise.all(
        [baseQuery, countQuery],
      );

      if (error) {
        logError("Error fetching bank statements", {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          error: error.message,
        });
        throw error;
      }

      if (countError) {
        logError("Error counting bank statements", {
          error: countError.message,
        });
      }

      // ── 1:1 match: fetch aggregates via reconciliation_id ──
      const statementsWithReconciliation = (data || []).filter(
        (s) => s.reconciliation_id,
      );
      const aggregateIds = [
        ...new Set(
          statementsWithReconciliation.map((s) => s.reconciliation_id),
        ),
      ];

      let aggregateMap: Record<string, any> = {};
      if (aggregateIds.length > 0) {
        try {
          const { data: aggregates, error: aggError } = await supabase
            .from("aggregated_transactions")
            .select(
              `
              id,
              transaction_date,
              gross_amount,
              nett_amount,
              payment_methods!inner (
                name
              )
            `,
            )
            .in("id", aggregateIds);

          if (aggError) {
            logError("Error fetching aggregates", { error: aggError.message });
          } else if (aggregates) {
            aggregateMap = aggregates.reduce(
              (acc: Record<string, any>, agg: any) => {
                acc[agg.id] = agg;
                return acc;
              },
              {},
            );
          }
        } catch (e: any) {
          logError("Error in aggregate fetch", { error: e.message });
        }
      }

      // ── Multi-match: fetch group data via reconciliation_group_id ──
      const statementsWithGroup = (data || []).filter(
        (s) => s.reconciliation_group_id && !s.reconciliation_id,
      );
      const groupIds = [
        ...new Set(statementsWithGroup.map((s) => s.reconciliation_group_id)),
      ];

      // Map: groupId → group + aggregate data
      let groupDataMap: Record<string, any> = {};
      if (groupIds.length > 0) {
        try {
          const { data: groups, error: grpError } = await supabase
            .from("bank_reconciliation_groups")
            .select(
              `
              id,
              aggregate_id,
              total_bank_amount,
              aggregate_amount,
              difference,
              aggregated_transactions (
                id,
                transaction_date,
                gross_amount,
                nett_amount,
                payment_methods!left (
                  name
                )
              )
            `,
            )
            .in("id", groupIds)
            .is("deleted_at", null);

          if (grpError) {
            logError("Error fetching group aggregates", { error: grpError.message });
          } else if (groups) {
            groupDataMap = groups.reduce(
              (acc: Record<string, any>, grp: any) => {
                acc[grp.id] = grp;
                return acc;
              },
              {},
            );
          }
        } catch (e: any) {
          logError("Error in group aggregate fetch", { error: e.message });
        }
      }

      // ── Settlement groups: fetch via bank_statement_id ──
      const reconciledWithoutLink = (data || []).filter(
        (s) => s.is_reconciled && !s.reconciliation_id && !s.reconciliation_group_id,
      );
      const reconciledWithoutLinkIds = reconciledWithoutLink.map((s) => s.id);

      // Map: statementId → settlement group data
      let settlementMap: Record<string, any> = {};
      if (reconciledWithoutLinkIds.length > 0) {
        try {
          const { data: settlements, error: setError } = await supabase
            .from("bank_settlement_groups")
            .select(
              `
              id,
              bank_statement_id,
              total_statement_amount,
              total_allocated_amount,
              difference,
              status,
              bank_settlement_aggregates (
                aggregate_id,
                allocated_amount,
                original_amount
              )
            `,
            )
            .in("bank_statement_id", reconciledWithoutLinkIds)
            .is("deleted_at", null);

          if (setError) {
            logError("Error fetching settlement groups", { error: setError.message });
          } else if (settlements) {
            settlementMap = settlements.reduce(
              (acc: Record<string, any>, sg: any) => {
                const bsId = String(sg.bank_statement_id);
                acc[bsId] = sg;
                return acc;
              },
              {},
            );
          }
        } catch (e: any) {
          logError("Error in settlement group fetch", { error: e.message });
        }
      }

      // ── Cash deposits: fetch via cash_deposit_id ──
      const statementsWithCashDeposit = (data || []).filter(
        (s: any) => s.cash_deposit_id,
      );
      const cashDepositIds = [
        ...new Set(statementsWithCashDeposit.map((s: any) => s.cash_deposit_id)),
      ];

      let cashDepositMap: Record<string, any> = {};
      if (cashDepositIds.length > 0) {
        try {
          const { data: deposits, error: depError } = await supabase
            .from("cash_deposits")
            .select("id, deposit_amount, deposit_date, branch_name, bank_account_id, status")
            .in("id", cashDepositIds);

          if (depError) {
            logError("Error fetching cash deposits", { error: depError.message });
          } else if (deposits) {
            cashDepositMap = deposits.reduce(
              (acc: Record<string, any>, dep: any) => {
                acc[dep.id] = dep;
                return acc;
              },
              {},
            );
          }
        } catch (e: any) {
          logError("Error in cash deposit fetch", { error: e.message });
        }
      }

      // Map data to include matched_aggregate (1:1, multi-match, settlement, or cash deposit)
      const mappedData = (data || []).map((row) => {
        // 1:1 match
        if (row.reconciliation_id && aggregateMap[row.reconciliation_id]) {
          const agg = aggregateMap[row.reconciliation_id];
          return {
            ...row,
            matched_aggregate: {
              id: agg.id,
              transaction_date: agg.transaction_date,
              gross_amount: agg.gross_amount,
              nett_amount: agg.nett_amount,
              payment_method_name: agg.payment_methods?.name || null,
            },
          };
        }
        // Multi-match: use group-level totals
        if (row.reconciliation_group_id && groupDataMap[row.reconciliation_group_id]) {
          const grp = groupDataMap[row.reconciliation_group_id];
          const agg = grp.aggregated_transactions;
          return {
            ...row,
            matched_aggregate: {
              id: agg?.id || grp.aggregate_id,
              transaction_date: agg?.transaction_date || null,
              gross_amount: agg?.gross_amount || 0,
              nett_amount: Number(grp.aggregate_amount) || 0,
              payment_method_name: agg?.payment_methods?.name || null,
              is_multi_match: true,
              group_total_bank_amount: Number(grp.total_bank_amount) || 0,
              group_difference: Number(grp.difference) || 0,
            },
          };
        }
        // Settlement group: 1 bank statement → many aggregates
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
        // Cash deposit match
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
            },
          };
        }
        return { ...row, matched_aggregate: null };
      });

      return {
        data: mappedData,
        total: count || 0,
      };
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
   * Used for filter dropdown - always returns all accounts regardless of transactions
   */
  async getAllBankAccounts(): Promise<any[]> {
    try {
      const { data: activeIds, error: activeError } = await supabase
        .from("bank_statements")
        .select("bank_account_id")
        .is("deleted_at", null);

      if (activeError) throw activeError;

      const uniqueIds = [
        ...new Set((activeIds || []).map((s) => s.bank_account_id)),
      ];
      if (uniqueIds.length === 0) {
        // Fallback: return semua akun jika belum ada statements sama sekali
        const { data } = await supabase
          .from("bank_accounts")
          .select(
            `id, account_name, account_number, banks(bank_name, bank_code)`,
          )
          .is("deleted_at", null)
          .order("account_name", { ascending: true });

        return (data || []).map((acc) => ({
          ...acc,
          stats: { total: 0, unreconciled: 0 },
        }));
      }
      const { data, error } = await supabase
        .from("bank_accounts")
        .select(`id, account_name, account_number, banks(bank_name, bank_code)`)
        .in("id", uniqueIds) // ← filter hanya yang punya data
        .is("deleted_at", null)
        .order("account_name", { ascending: true });

      if (error) throw error;

      return (data || []).map((acc) => ({
        ...acc,
        stats: { total: 0, unreconciled: 0 },
      }));
    } catch (error: any) {
      logError("Error fetching all bank accounts", { error: error.message });
      throw new DatabaseConnectionError(
        "fetching all bank accounts",
        error.message,
      );
    }
  }

  /**
   * Get list of bank accounts with reconciliation summaries for a period
   */
  async getBankAccountsStatus(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("bank_account_id, is_reconciled")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .is("deleted_at", null);

      if (error) {
        throw error;
      }

      const stats = (data || []).reduce((acc: any, curr: any) => {
        const bId = curr.bank_account_id;
        if (!acc[bId]) {
          acc[bId] = { total: 0, unreconciled: 0 };
        }
        acc[bId].total++;
        if (!curr.is_reconciled) {
          acc[bId].unreconciled++;
        }
        return acc;
      }, {});

      const accountIds = Object.keys(stats).map((id) => parseInt(id));
      if (accountIds.length === 0) return [];

      const { data: accounts, error: accError } = await supabase
        .from("bank_accounts")
        .select(
          `
        id,
        account_name,
        account_number,
        banks (
          bank_name,
          bank_code
        )
      `,
        )
        .in("id", accountIds);

      if (accError) {
        throw accError;
      }

      return accounts.map((acc) => ({
        ...acc,
        stats: stats[acc.id],
      }));
    } catch (error: any) {
      logError("Error fetching bank accounts status", {
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "fetching bank accounts status",
        error.message,
      );
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

      const updateData: any = {
        is_reconciled: isReconciled,
        updated_at: new Date().toISOString(),
      };

      if (userId) {
        updateData.updated_by = userId;
      }

      const { error } = await supabase
        .from("bank_statements")
        .update(updateData)
        .eq("id", id);

      if (error) {
        throw error;
      }
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
      // Get payment_method_id from aggregate
      const { data: aggregate, error: aggError } = await supabase
        .from("aggregated_transactions")
        .select("payment_method_id")
        .eq("id", aggregateId)
        .maybeSingle();

      if (aggError) {
        throw aggError;
      }

      // Update statement - only use fields that are confirmed to exist
      const updateData: any = {
        is_reconciled: true,
        reconciliation_id: aggregateId,
        updated_at: new Date().toISOString(),
      };

      // Only add payment_method_id if aggregate has it
      if (aggregate?.payment_method_id) {
        updateData.payment_method_id = aggregate.payment_method_id;
      }

      // Add updated_by if userId is provided
      if (userId) {
        updateData.updated_by = userId;
      }

      const { error } = await supabase
        .from("bank_statements")
        .update(updateData)
        .eq("id", statementId);

      if (error) {
        throw error;
      }
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
      const updateData: any = {
        is_reconciled: isReconciled,
        updated_at: new Date().toISOString(),
      };

      if (userId) {
        updateData.updated_by = userId;
      }

      const { error } = await supabase
        .from("bank_statements")
        .update(updateData)
        .in("id", ids);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error bulk updating reconciliation status", {
        count: ids.length,
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "bulk update reconciliation status",
        error.message,
      );
    }
  }

  async countReconciledStatementsInGroup(groupId: string): Promise<number> {
    // Setelah undoReconciliation dipanggil, statement ini sudah is_reconciled = false
    // Jadi query ini menghitung yang MASIH reconciled di group
    const { data, error } = await supabase
      .from("bank_reconciliation_group_details")
      .select("bank_statements!inner(is_reconciled)")
      .eq("group_id", groupId)
      .eq("bank_statements.is_reconciled", true);

    if (error) throw error;
    return data?.length ?? 0;
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
      let query = supabase
        .from("bank_statements")
        .select("*")
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null);

      if (bankAccountId) {
        query = query.eq("bank_account_id", bankAccountId);
      }

      const { data, error } = await query
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }
      return data || [];
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
      let query = supabase
        .from("bank_statements")
        .select("*", { count: "exact", head: true })
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null);

      if (bankAccountId) {
        query = query.eq("bank_account_id", bankAccountId);
      }

      const { count, error } = await query;

      if (error) {
        logError("Error counting unreconciled statements", { error: error.message });
        return 0;
      }
      return count || 0;
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
      const { error } = await supabase.from("bank_reconciliation_logs").insert({
        company_id: data.companyId,
        user_id: data.userId,
        action: data.action,
        statement_id: data.statementId,
        aggregate_id: data.aggregateId,
        details: data.details || {},
      });

      if (error) {
        throw error;
      }
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
   * Cascades reset to aggregated_transactions and pos_sync_aggregates if applicable.
   */
  async undoReconciliation(
    statementId: string,
    userId?: string,
  ): Promise<void> {
    try {
      // 1. Capture reconciliation_id before resetting
      const { data: stmt } = await supabase
        .from("bank_statements")
        .select("reconciliation_id")
        .eq("id", statementId)
        .single();

      const reconciliationId = stmt?.reconciliation_id;

      // 2. Reset bank_statements
      const updateData: any = {
        is_reconciled: false,
        reconciliation_id: null,
        reconciliation_group_id: null,
        updated_at: new Date().toISOString(),
      };

      if (userId) updateData.updated_by = userId;

      const { error } = await supabase
        .from("bank_statements")
        .update(updateData)
        .eq("id", statementId);

      if (error) throw error;

      // 3. Reset aggregated_transactions + pos_sync_aggregates if linked
      if (reconciliationId) {
        const { data: aggTx } = await supabase
          .from("aggregated_transactions")
          .select("id, pos_sync_aggregate_id, source_type")
          .eq("id", reconciliationId)
          .single();

        if (aggTx) {
          await supabase
            .from("aggregated_transactions")
            .update({
              is_reconciled: false,
              // Reset to schema defaults (NOT NULL default 0)
              actual_fee_amount: 0,
              fee_discrepancy: 0,
              fee_discrepancy_note: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", reconciliationId);

          // If source is POS_SYNC, also reset pos_sync_aggregates
          if (aggTx.source_type === "POS_SYNC" && aggTx.pos_sync_aggregate_id) {
            await supabase
              .from("pos_sync_aggregates")
              .update({
                is_reconciled: false,
                bank_statement_id: null,
                actual_fee_amount: null,
                fee_discrepancy: null,
                fee_discrepancy_note: null,
                reconciled_at: null,
                reconciled_by: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", aggTx.pos_sync_aggregate_id);
          }
        }
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
      const { data: group, error } = await supabase
        .from("bank_reconciliation_groups")
        .insert({
          aggregate_id: data.aggregateId,
          company_id: data.companyId,
          total_bank_amount: data.totalBankAmount,
          aggregate_amount: data.aggregateAmount,
          difference: data.difference,
          notes: data.notes,
          reconciled_by: data.reconciledBy,
          updated_at: new Date().toISOString(),
          status:
            Math.abs(data.difference) <= 100 ? "RECONCILED" : "DISCREPANCY",
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }
      return group.id;
    } catch (error: any) {
      throw new DatabaseConnectionError(
        "creating reconciliation group",
        error.message,
      );
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
      const details = statements.map((s) => ({
        group_id: groupId,
        statement_id: s.statementId,
        amount: s.amount,
      }));

      const { error } = await supabase
        .from("bank_reconciliation_group_details")
        .insert(details);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logError("Error adding statements to group", {
        groupId,
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "adding statements to group",
        error.message,
      );
    }
  }

  /**
   * Get reconciliation group by ID with all details
   */
  async getReconciliationGroupById(groupId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_groups")
        .select(
          `
        *,
        aggregated_transactions (
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (
            name
          )
        ),
        bank_reconciliation_group_details (
          *,
          bank_statements (
            id,
            transaction_date,
            description,
            debit_amount,
            credit_amount
          )
        )
      `,
        )
        .eq("id", groupId)
        .is("deleted_at", null)
        .single();

      if (error) {
        throw error;
      }
      return data;
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
      const updateData: any = {
        is_reconciled: true,
        reconciliation_group_id: groupId,
        updated_at: new Date().toISOString(),
      };

      if (userId) {
        updateData.updated_by = userId;
      }

      const { error } = await supabase
        .from("bank_statements")
        .update(updateData)
        .in("id", statementIds);

      if (error) {
        throw error;
      }
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
   * Undo reconciliation - reset statements, cascade to aggregated_tx/pos_sync, soft delete group
   */
  async undoReconciliationGroup(
    groupId: string,
    userId?: string,
  ): Promise<void> {
    try {
      const group = await this.getReconciliationGroupById(groupId);
      if (!group) throw new Error("Group not found");

      const statementIds = (group.bank_reconciliation_group_details || []).map(
        (d: any) => d.statement_id,
      );

      // 1. Reset bank_statements
      if (statementIds.length > 0) {
        const updateData: any = {
          is_reconciled: false,
          reconciliation_group_id: null,
          updated_at: new Date().toISOString(),
        };

        if (userId) {
          updateData.updated_by = userId;
        }

        const { error } = await supabase
          .from("bank_statements")
          .update(updateData)
          .in("id", statementIds);

        if (error) throw error;
      }

      // 2. Reset aggregated_transactions + pos_sync_aggregates if linked
      if (group.aggregate_id) {
        const { data: aggTx } = await supabase
          .from("aggregated_transactions")
          .select("id, pos_sync_aggregate_id, source_type")
          .eq("id", group.aggregate_id)
          .single();

        if (aggTx) {
          await supabase
            .from("aggregated_transactions")
            .update({
              is_reconciled: false,
              // Reset to schema defaults (NOT NULL default 0)
              actual_fee_amount: 0,
              fee_discrepancy: 0,
              fee_discrepancy_note: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", group.aggregate_id);

          // If POS_SYNC, cascade to pos_sync_aggregates
          if (aggTx.source_type === "POS_SYNC" && aggTx.pos_sync_aggregate_id) {
            await supabase
              .from("pos_sync_aggregates")
              .update({
                is_reconciled: false,
                bank_statement_id: null,
                actual_fee_amount: null,
                fee_discrepancy: null,
                fee_discrepancy_note: null,
                reconciled_at: null,
                reconciled_by: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", aggTx.pos_sync_aggregate_id);
          }
        }
      }

      // 3. Soft delete group
      const { error } = await supabase
        .from("bank_reconciliation_groups")
        .update({
          deleted_at: new Date().toISOString(),
          status: "UNDO",
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      if (error) throw error;
    } catch (error: any) {
      logError("Error undoing reconciliation group", {
        groupId,
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "undoing reconciliation group",
        error.message,
      );
    }
  }

  /**
   * Check if aggregate is already part of a group
   */
  async isAggregateInGroup(aggregateId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_groups")
        .select("id")
        .eq("aggregate_id", aggregateId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }
      return !!data;
    } catch (error: any) {
      logError("Error checking if aggregate is in group", {
        aggregateId,
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "checking aggregate group status",
        error.message,
      );
    }
  }
  async softDeleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase
      .from("bank_reconciliation_groups")
      .update({
        deleted_at: new Date().toISOString(),
        status: "UNDO",
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (error) throw error;
  }
  /**
   * Get unreconciled statements by date range for suggestion algorithm
   */
  async getUnreconciledStatementsForSuggestion(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_statements")
        .select(
          "id, transaction_date, description, debit_amount, credit_amount",
        )
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .eq("is_reconciled", false)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });

      if (error) {
        throw error;
      }
      return data || [];
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
   * Filter by aggregated_transactions.transaction_date instead of created_at
   * to match user's selected date range filter
   */
  async getReconciliationGroups(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("bank_reconciliation_groups")
        .select(
          `
        *,
        aggregated_transactions (
          id,
          transaction_date,
          gross_amount,
          nett_amount,
          payment_methods!left (name)
        )
      `,
        )
        .gte(
          "aggregated_transactions.transaction_date",
          startDate.toISOString().split("T")[0],
        )
        .lte(
          "aggregated_transactions.transaction_date",
          endDate.toISOString().split("T")[0],
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        logError("Error fetching reconciliation groups (main query)", {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          error: error.message,
        });
        throw error;
      }

      // Fetch details separately for each group to avoid join issues
      const groupIds = (data || []).map((group: any) => group.id);
      let detailsMap: Record<string, any[]> = {};

      if (groupIds.length > 0) {
        try {
          const { data: detailsData, error: detailsError } = await supabase
            .from("bank_reconciliation_group_details")
            .select(
              `
              *,
              bank_statements (
                id,
                transaction_date,
                description,
                debit_amount,
                credit_amount
              )
            `,
            )
            .in("group_id", groupIds);

          if (detailsError) {
            logError("Error fetching group details", {
              error: detailsError.message,
            });
          } else if (detailsData) {
            // Group details by group_id
            detailsMap = detailsData.reduce(
              (acc: Record<string, any[]>, detail: any) => {
                if (!acc[detail.group_id]) {
                  acc[detail.group_id] = [];
                }
                acc[detail.group_id].push(detail);
                return acc;
              },
              {},
            );
          }
        } catch (e: any) {
          logError("Error in details fetch", { error: e.message });
        }
      }

      // Transform data to match frontend ReconciliationGroup interface
      const transformedData = (data || []).map((group: any) => ({
        ...group,
        // Rename aggregated_transactions to aggregate for frontend compatibility
        aggregate: group.aggregated_transactions
          ? {
              id: group.aggregated_transactions.id,
              transaction_date: group.aggregated_transactions.transaction_date,
              gross_amount: group.aggregated_transactions.gross_amount,
              nett_amount: group.aggregated_transactions.nett_amount,
              payment_method_name:
                group.aggregated_transactions.payment_methods?.name || null,
            }
          : undefined,
        // Map details array from the separate query
        details: (detailsMap[group.id] || []).map((detail: any) => ({
          id: detail.id,
          statement_id: detail.statement_id,
          amount: detail.amount,
          statement: detail.bank_statements
            ? {
                id: detail.bank_statements.id,
                transaction_date: detail.bank_statements.transaction_date,
                description: detail.bank_statements.description,
                debit_amount: detail.bank_statements.debit_amount,
                credit_amount: detail.bank_statements.credit_amount,
              }
            : undefined,
        })),
      }));

      return transformedData;
    } catch (error: any) {
      logError("Error fetching reconciliation groups", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        error: error.message,
      });
      throw new DatabaseConnectionError(
        "fetching reconciliation groups",
        error.message,
      );
    }
  }

  async markAsReconciledCashDeposit(
    statementId: string,
    cashDepositId: string,
    userId?: string,
  ): Promise<void> {
    const updateData: any = {
      is_reconciled: true,
      cash_deposit_id: cashDepositId,
      updated_at: new Date().toISOString(),
    };
    if (userId) updateData.updated_by = userId;

    const { error } = await supabase
      .from("bank_statements")
      .update(updateData)
      .eq("id", statementId);

    if (error) throw error;
  }

  async undoCashDepositReconciliation(
    statementId: string,
    cashDepositId: string,
    userId?: string,
  ): Promise<void> {
    // 1. Reset bank statement
    const updateData: any = {
      is_reconciled: false,
      cash_deposit_id: null,
      updated_at: new Date().toISOString(),
    };
    if (userId) updateData.updated_by = userId;

    const { error: stmtErr } = await supabase
      .from("bank_statements")
      .update(updateData)
      .eq("id", statementId);
    if (stmtErr) throw stmtErr;

    // 2. Reset cash deposit → DEPOSITED (bukan PENDING, karena bukti setoran masih ada)
    const { error: depErr } = await supabase
      .from("cash_deposits")
      .update({
        status: "DEPOSITED",
        bank_statement_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cashDepositId);
    if (depErr) throw depErr;
  }
}

export const bankReconciliationRepository = new BankReconciliationRepository();
